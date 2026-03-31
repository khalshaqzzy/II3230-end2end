# Local LAN Runbook
Purpose: panduan pengujian LAN untuk memvalidasi alur pengiriman pesan aman antara Alice dan Bob pada dua device dalam satu jaringan.


## Tujuan Pengujian

Runbook ini dipakai untuk membuktikan bahwa sistem benar-benar berjalan dalam skenario yang diminta tugas:

- Alice mengirim pesan dari satu device
- Bob menerima dan memverifikasi pesan di device lain
- komunikasi terjadi melalui alamat IP di jaringan lokal
- sistem menghasilkan artefak yang bisa dipakai untuk evaluasi, laporan, atau demo

Target pengujian yang harus tervalidasi:

1. happy path berjalan end to end
2. skenario manipulasi payload ditolak pada tahap yang benar
3. message detail dan event log cukup kaya untuk dibaca ulang setelah test selesai

## Gambaran Topologi

Pengujian dilakukan dengan dua device dalam satu LAN.

- Device A berperan sebagai Alice
  - dipakai untuk menjalankan script pengiriman dan script validasi
- Device B berperan sebagai Bob
  - menjalankan API penerima
  - menyimpan message detail, verdict, dan event log

Target Bob yang dipakai Alice selalu berbentuk:

```text
http://<bob-lan-ip>:4000
```

Contoh:

```text
http://192.168.1.20:4000
```

## Sebelum Mulai

Pastikan hal berikut sudah tersedia:

- repo project ini ada di kedua device
- dependency project sudah terpasang
- kedua device ada di jaringan lokal yang sama
- Device A bisa menjangkau IP Device B
- port `4000` di Device B tidak diblokir

Disarankan melakukan pengecekan sederhana dulu dari Device A ke Device B, misalnya ping atau akses HTTP ke IP Bob jika environment memungkinkan.

## Penempatan Key

Direktori key lokal yang dipakai sistem:

```text
.local/data/keys/
```

Generate keypair dari root repo:

```powershell
npm run keys:generate:local
```

### Key yang dibutuhkan di Device A

Device A hanya perlu key untuk bertindak sebagai Alice:

- `.local/data/keys/alice/private.pem`
- `.local/data/keys/alice/public.pem`
- `.local/data/keys/bob/public.pem`

Device A tidak perlu Bob private key.

### Key yang dibutuhkan di Device B

Device B hanya perlu key untuk bertindak sebagai Bob:

- `.local/data/keys/alice/public.pem`
- `.local/data/keys/bob/private.pem`
- `.local/data/keys/bob/public.pem`

Device B tidak perlu Alice private key.

## Langkah 1: Menyalakan Bob di Device B

Buat file env khusus Bob, misalnya `.env.bob.local`.

```dotenv
PORT=4000
LOG_LEVEL=info
APP_ENV=development
APP_DATA_DIR=.local/data
ALICE_LOGICAL_IP=10.10.0.2
BOB_LOGICAL_IP=10.10.0.3
ALICE_PUBLIC_KEY_PATH=.local/data/keys/alice/public.pem
BOB_PRIVATE_KEY_PATH=.local/data/keys/bob/private.pem
BOB_PUBLIC_KEY_PATH=.local/data/keys/bob/public.pem
BOB_TARGET_BASE_URL=http://127.0.0.1:4000
```

Jalankan Bob:

```powershell
npm run bob:lan -- --env-file .env.bob.local
```

Setelah service aktif, Bob akan listen di port `4000`.

## Langkah 2: Memastikan Bob Bisa Diakses

Dari Device A, lakukan pengecekan berikut:

```powershell
Invoke-WebRequest -UseBasicParsing http://<bob-lan-ip>:4000/health
Invoke-WebRequest -UseBasicParsing http://<bob-lan-ip>:4000/ready
```

Expected result:

- `/health` mengembalikan status `ok`
- `/ready` mengembalikan status `ready`

Jika dua endpoint ini gagal diakses, jangan lanjut ke pengujian berikutnya. Biasanya masalah ada pada IP target, port, firewall, atau Bob belum benar-benar berjalan.

## Langkah 3: Menyiapkan Alice di Device A

Buat file env khusus Alice, misalnya `.env.alice.local`.

```dotenv
PORT=4000
LOG_LEVEL=info
APP_ENV=development
APP_DATA_DIR=.local/data
ALICE_LOGICAL_IP=10.10.0.2
BOB_LOGICAL_IP=10.10.0.3
ALICE_PRIVATE_KEY_PATH=.local/data/keys/alice/private.pem
ALICE_PUBLIC_KEY_PATH=.local/data/keys/alice/public.pem
BOB_PUBLIC_KEY_PATH=.local/data/keys/bob/public.pem
BOB_TARGET_BASE_URL=http://<bob-lan-ip>:4000
```

Ganti `<bob-lan-ip>` dengan IP Device B yang benar.

## Langkah 4: Menjalankan Happy Path

Ini adalah pengujian utama untuk memastikan alur pengiriman pesan aman berjalan normal.

Jalankan:

```powershell
npm run test:e2e:local -- --env-file .env.alice.local
```

Expected result:

- output JSON menandakan happy path `passed`
- verdict akhir bernilai `accepted`
- Bob menyimpan hasil pengujian dengan `messageId` yang bisa ditinjau ulang
- output juga menampilkan `testRunId` untuk menandai satu sesi pengujian

Hal yang perlu dicatat saat testing:

- `messageId`
- `testRunId`
- lokasi `artifactDir`
- verdict akhir

## Langkah 5: Meninjau Detail Pesan dan Event Log

Jika Anda ingin melihat hasil pengujian lebih detail, gunakan `messageId` dari happy path tadi.

Fetch message detail:

```powershell
npx tsx scripts/manual-fetch-message.ts --env-file .env.alice.local --target http://<bob-lan-ip>:4000 <messageId>
```

Fetch event log:

```powershell
npx tsx scripts/manual-fetch-logs.ts --env-file .env.alice.local --target http://<bob-lan-ip>:4000 <messageId>
```

Saat meninjau hasil, perhatikan bahwa:

- ciphertext ada
- encrypted symmetric key ada
- hash ada
- signature ada
- Bob berhasil mendekripsi plaintext
- integrity check sukses
- signature verification sukses
- timeline event memuat inferred Alice events untuk direct-LAN flow
- event Bob memuat context request seperti `actualRequesterIp`, `remoteAddress`, `validationMode`, `testRunId`, dan `scenario`

Dengan ini tester bisa membaca ulang bukan hanya hasil akhir, tetapi juga konteks bagaimana test itu dijalankan.

## Langkah 6: Menjalankan Negative Path

Setelah happy path lolos, lanjutkan dengan pengujian skenario gagal.

Jalankan seluruh suite:

```powershell
npm run test:e2e:tamper -- --env-file .env.alice.local
```

Expected result:

- semua skenario tampil sebagai `passed`
- setiap skenario gagal pada tahap verifikasi yang sesuai
- setiap run negatif juga punya `testRunId` tersendiri

Tahap kegagalan yang diharapkan:

- ciphertext tamper -> `decrypt_ciphertext`
- hash tamper -> `verify_hash`
- signature tamper -> `verify_signature`
- wrong-recipient-key -> `decrypt_symmetric_key`

Ini penting, karena yang divalidasi bukan hanya “gagal”, tetapi “gagal dengan alasan yang benar”.

## Langkah 7: Menjalankan Uji Manual Jika Diperlukan

Jika Anda ingin menguji skenario tertentu secara manual, gunakan script berikut.

Kirim pesan biasa:

```powershell
npx tsx scripts/manual-send.ts --env-file .env.alice.local --target http://<bob-lan-ip>:4000 --message "Bob, ini pesan happy-path LAN untuk validasi."
```

Tamper ciphertext:

```powershell
npx tsx scripts/manual-tamper.ts --env-file .env.alice.local --target http://<bob-lan-ip>:4000 --field ciphertext
```

Simulasi wrong recipient key:

```powershell
npx tsx scripts/manual-tamper.ts --env-file .env.alice.local --target http://<bob-lan-ip>:4000 --scenario wrong-recipient-key
```

Pengujian manual berguna jika tester ingin menunjukkan satu kasus spesifik saat demo atau saat debugging.

## Artefak Yang Harus Dicek

Setiap pengujian otomatis akan menulis hasil ke:

```text
artifacts/local-tests/<timestamp>/
```

File yang biasanya perlu dicek:

- `summary.json`
- `happy-path-response.json`
- `tamper-ciphertext-response.json`
- `tamper-hash-response.json`
- `tamper-signature-response.json`
- `wrong-recipient-response.json`
- `messages/<messageId>.json`
- `logs/<messageId>.json`


## Checklist Singkat

Pengujian bisa dianggap selesai jika:

1. Bob berhasil diakses dari device lain melalui LAN
2. happy path menghasilkan verdict `accepted`
3. empat skenario negative path semuanya lolos validasi
4. artefak hasil uji tersimpan
5. tester dapat menunjukkan `messageId`, `testRunId`, detail pesan, dan log verifikasi saat diminta

## Catatan Penting

- Jalur bukti utama untuk validasi LAN dua device adalah pengiriman langsung ke Bob melalui `/internal/messages/receive`
- `POST /messages` masih ada, tetapi bukan jalur utama untuk pengujian LAN
- jika hasil tidak sesuai, cek dulu env file, key placement, IP target, akses port `4000`, dan apakah Bob benar-benar listen di host yang tepat
