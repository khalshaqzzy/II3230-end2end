# Local LAN Runbook
Purpose: panduan pengujian LAN untuk memvalidasi alur pengiriman pesan aman antara Alice dan Bob pada dua device dalam satu jaringan.


## Tujuan Pengujian

Runbook ini dipakai untuk membuktikan bahwa sistem benar-benar berjalan dalam skenario yang diminta tugas:

- Alice mengirim pesan dari satu device
- Bob menerima dan memverifikasi pesan di device lain
- komunikasi terjadi melalui alamat IP di jaringan lokal
- sistem menghasilkan bukti yang bisa dipakai untuk evaluasi atau laporan

Target utama adalah memastikan tiga hal berikut:

1. happy path berjalan end to end
2. skenario manipulasi payload ditolak pada tahap yang benar
3. artefak hasil uji tersimpan dan bisa ditinjau ulang

## Gambaran Sederhana Topologi

Pengujian dilakukan dengan dua device dalam satu LAN.

- Device A berperan sebagai Alice
  - digunakan untuk mengirim pesan dan menjalankan script pengujian
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

Pastikan hal berikut sudah tersedia di kedua device:

- repo project ini sudah ada
- dependency project sudah terpasang
- kedua device berada di jaringan lokal yang sama
- Device A dapat menjangkau IP Device B
- port `4000` di Device B tidak diblokir firewall lokal

Disarankan melakukan pengecekan sederhana dulu dari Device A ke Device B, misalnya ping atau akses HTTP ke IP Bob jika environment memungkinkan.

## Penempatan Key

Sistem sekarang memakai direktori key lokal yang konsisten:

```text
.local/data/keys/
```

Generate keypair dari root repo:

```powershell
npm run keys:generate:local
```

Setelah generate, distribusikan file sesuai peran tester:

### Key yang dibutuhkan di Device A

Device A hanya perlu key untuk mengirim sebagai Alice:

- `.local/data/keys/alice/private.pem`
- `.local/data/keys/alice/public.pem`
- `.local/data/keys/bob/public.pem`

Device A tidak perlu Bob private key.

### Key yang dibutuhkan di Device B

Device B hanya perlu key untuk menerima dan memverifikasi sebagai Bob:

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

Jika dua endpoint ini gagal diakses, jangan lanjut ke pengujian berikutnya. Masalah biasanya ada pada IP target, port, firewall, atau Bob belum berjalan.

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

Ini adalah pengujian utama untuk memastikan skenario pengiriman pesan aman berjalan normal.

Jalankan:

```powershell
npm run test:e2e:local -- --env-file .env.alice.local
```

Expected result:

- test mendapatkan output JSON yang menandakan happy path `passed`
- verdict akhir bernilai `accepted`
- pesan berhasil diproses oleh Bob

Hal yang perlu dicatat saat testing:

- `messageId`
- lokasi `artifactDir`
- verdict akhir

## Langkah 5: Meninjau Detail Pesan dan Log

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

## Langkah 6: Menjalankan Negative Path

Setelah happy path lolos, lanjutkan dengan pengujian skenario gagal.

Jalankan seluruh suite:

```powershell
npm run test:e2e:tamper -- --env-file .env.alice.local
```

Expected result:

- semua skenario tampil sebagai `passed`
- setiap skenario gagal pada tahap verifikasi yang sesuai

Tahap kegagalan yang diharapkan:

- ciphertext tamper -> `decrypt_ciphertext`
- hash tamper -> `verify_hash`
- signature tamper -> `verify_signature`
- wrong-recipient-key -> `decrypt_symmetric_key`

Ini penting untuk testing, karena yang divalidasi bukan hanya “gagal”, tetapi “gagal dengan alasan yang benar”.

## Langkah 7: Menjalankan Uji Manual Jika Diperlukan

Jika Anda ingin menguji skenario tertentu secara manual, gunakan script berikut.

Kirim pesan biasa:

```powershell
npx tsx scripts/manual-send.ts --env-file .env.alice.local --target http://<bob-lan-ip>:4000 --message "Bob, ini pesan LAN Phase 4."
```

Tamper ciphertext:

```powershell
npx tsx scripts/manual-tamper.ts --env-file .env.alice.local --target http://<bob-lan-ip>:4000 --field ciphertext
```

Simulasi wrong recipient key:

```powershell
npx tsx scripts/manual-tamper.ts --env-file .env.alice.local --target http://<bob-lan-ip>:4000 --scenario wrong-recipient-key
```

Pengujian manual berguna jika testing ingin menunjukkan satu kasus spesifik saat demo atau saat debugging.

## Artefak Yang Harus Dicek

Setiap pengujian otomatis akan menulis hasil ke:

```text
artifacts/local-tests/<timestamp>/
```

File yang biasanya perlu ketika testing:

- `summary.json`
- `happy-path-response.json`
- `tamper-ciphertext-response.json`
- `tamper-hash-response.json`
- `tamper-signature-response.json`
- `wrong-recipient-response.json`
- `messages/<messageId>.json`
- `logs/<messageId>.json`


## Checklist Singkat Untuk Testing

Pengujian bisa dianggap selesai jika:

1. Bob berhasil diakses dari device lain melalui LAN
2. happy path menghasilkan verdict `accepted`
3. empat skenario negative path semuanya lolos validasi
4. artefak hasil uji tersimpan
5. test dapat menunjukkan `messageId`, detail pesan, dan log verifikasi saat diminta

## Catatan Penting

- Jalur bukti saat ini yang paling penting adalah pengiriman langsung ke Bob melalui `/internal/messages/receive`
- `POST /messages` masih ada, tetapi bukan jalur utama untuk validasi LAN dua device
- runbook ini ditulis untuk testingr; jika hasil tidak sesuai, cek dulu env file, key placement, IP target, dan akses port `4000`
