const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const baseUrl = 'https://www.patibul.com/2/kedi-ilanlari/';
const toplamSayfa = 25;
const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36';

const headers = {
  'User-Agent': userAgent,
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Cache-Control': 'max-age=0',
};

async function veriCek() {
  const anaVeriler = [];

  for (let sayfa = 1; sayfa <= toplamSayfa; sayfa++) {
    const url = `${baseUrl}${sayfa}`;

    try {
      const yanit = await axios.get(url, { headers });


      if (yanit.status === 200) {
        const $ = cheerio.load(yanit.data);

        $('tbody tr').each(async (index, element) => {
          const baslik = $(element).find('.baslik a').text();
          const resimUrl = $(element).find('.resim').attr('src');
          const fiyat = $(element).find('.fiyat').text().trim();
          const hamTarih = $(element).find('.visible-md.visible-lg').text().trim();
          const lokasyonArray = $(element).find('.il_ilce span').toArray().map(span => $(span).text());
          const benzersizLokasyonlar = Array.from(new Set(lokasyonArray)).join(' ');

          // Bağlantıyı çıkarma
          const ilanLinki = $(element).find('.baslik a').attr('href');

          // Tüm alanların boş olup olmadığını kontrol et
          if (baslik || resimUrl || fiyat || tarihFormatla(hamTarih) || benzersizLokasyonlar || ilanLinki) {
            const ilanDetaylari = await ilanDetaylariniCek(ilanLinki);
            anaVeriler.push({
              baslik,
              resimUrl,
              fiyat,
              tarih: tarihFormatla(hamTarih),
              lokasyon: benzersizLokasyonlar,
              ilanLinki,
              ilanDetaylari,
            });
          }
        });
      } else {
        console.log(`Hata: Sayfa ${sayfa} alınamadı. İşlem durduruluyor.`);
        break;
      }
    } catch (hata) {
      console.error('Hata:', hata.message);
      break;
    }
  }

  const jsonVerisi = JSON.stringify(anaVeriler, null, 2);

  fs.writeFileSync('veri.json', jsonVerisi);

  console.log('Veriler başarıyla output.json dosyasına kaydedildi.');
}


async function ilanDetaylariniCek(ilanLinki) {
  const detaylar = [];

  try {
    const yanit = await axios.get(ilanLinki);

    if (yanit.status === 200) {
      const $ = cheerio.load(yanit.data);

      // Resimleri al
      const resimler = [];
      $('.galeri_gorsel').each((index, element) => {
        const resimUrl = $(element).data('full-url');
        if (resimUrl) {
          resimler.push(resimUrl);
        }
      });

      // Üye bilgilerini al
      const uyeAdi = $('.blurry h3 a').text();
      const uyeTarih = $('.blurry p').text().trim().replace('Üyelik tarihi:', '');

      // Adres bilgilerini al
      const adres = [];
      $('.adres li').each((index, element) => {
        const adresBilgisi = $(element).text().trim();
        adres.push(adresBilgisi);
      });
      const formattedAdres = adres.join(' » ');

      // Detay bilgilerini al
      const detayBilgileri = {};
      $('.table.detay tbody tr').each((index, element) => {
        const key = $(element).find('th').text().trim();
        const value = $(element).find('td').text().trim();
        detayBilgileri[key] = value;
      });

      // Telefon numarasını al
      const telefonNumarasiMatch = $('.prel').text().match(/\b\d{4}\s?\d{3}\s?\d{2}\s?\d{2}\b/);
      const telefonNumarasi = telefonNumarasiMatch ? telefonNumarasiMatch[0].replace(/\D/g, '') : 'Numara Bulunamadı';

      // İlan içeriğini al
      const ilanIcerigi = $('.ilan_icerik p').text().trim();

      detaylar.push({
        resimler,
        uyeAdi,
        uyeTarih,
        adres: formattedAdres,
        detayBilgileri,
        telefonNumarasi,
        ilanIcerigi,
      });
    } else {
      console.log(`Hata: İlan detayları alınamadı. İşlem devam ediyor.`);
    }
  } catch (hata) {
    console.error('Hata:', hata.message);
  }

  return detaylar;
}



function tarihFormatla(hamTarih) {
  const tarihDizisi = hamTarih.split(/\s+/).filter(str => str.trim() !== '');
  return tarihDizisi.slice(1, 4).join(' ');
}

veriCek();
