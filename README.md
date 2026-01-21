# MothrBox 🦋🔒

**Encrypted Decentralized Storage System**

MothrBox combines military-grade encryption with Walrus Protocol's decentralized storage, enabling secure, censorship-resistant data storage.

---

## Introduction

MothrBox is a command-line tool that encrypts your files locally before uploading them to decentralized storage. Your data is:

- **🔐 Encrypted locally** - Files never leave your machine unencrypted
- **🌐 Stored decentrally** - Distributed across Walrus Protocol nodes
- **🔑 Password-protected** - Only you can decrypt with your password
- **♾️ Censorship-resistant** - No single point of failure

### Key Features

- **Multiple Encryption Algorithms**: AES-256-GCM, ChaCha20-Poly1305, ECC
- **Walrus Integration**: Decentralized storage with erasure coding
- **Docker-based**: No dependency installation required
- **Simple CLI**: Encrypt, upload, download, decrypt in one command

### How It Works

```
Your File → Encrypt (AES-256) → Upload (Walrus) → Blob ID
                                                      ↓
Recovered File ← Decrypt ← Download ← Blob ID shared via any channel
```

---

## Installation

### Prerequisites

1. **Docker** (v20.10+)
   - Linux/macOS: https://docs.docker.com/get-docker/
   - Windows: Use WSL2 + Docker Desktop

2. **Sui Wallet Private Key** (testnet recommended)
   - Get testnet SUI: https://faucet.testnet.sui.io/
   - Key format: `suiprivkey1...`
   - Export from Sui wallet or CLI: `sui client export`

### Setup Steps

```bash
# 1. Clone repository
git clone <repository-url>
cd mothrbox_v2

# 2. Make scripts executable
chmod +x mothrbox mothrbox_entrypoint.sh

# 3. Run configuration wizard
./mothrbox setup
# - Select network: 1 (Testnet)
# - Paste your Sui private key (hidden input)
# - Confirm key

# 4. Build Docker image (~3-5 minutes)
./mothrbox build

# 5. Verify installation
./mothrbox test
# Expected: ✅ Encryption/Decryption OK
```

**Troubleshooting:** See [PREREQUISITES.md](PREREQUISITES.md) for detailed setup help.

---

## ⚡ Quickstart

### Basic Workflow

```bash
# Create a test file
echo "My secret data!" > secret.txt

# Encrypt and upload to Walrus
./mothrbox encrypt secret.txt "MyPassword123"
# Output: 📦 Encrypted Blob ID: DcNxScTcvltoCYZwLPVC45QNFpddxjL8FmueI7I7-Ho

# Download and decrypt (share blob ID separately from password!)
./mothrbox decrypt DcNxScTcvltoCYZwLPVC45QNFpddxjL8FmueI7I7-Ho recovered.txt "MyPassword123"

# Verify
cat recovered.txt
# Output: My secret data!
```

### Available Commands

```bash
# Setup and system
./mothrbox setup              # Configure Sui wallet
./mothrbox build              # Build Docker image
./mothrbox test               # Run system test

# Encrypt and upload
./mothrbox encrypt <file> <password>

# Download and decrypt
./mothrbox decrypt <blob-id> <output> <password>

# Generate ECC keys (asymmetric encryption)
./mothrbox keygen

# Advanced: Direct CLI access
./mothrbox cli <command> [args...]
```

### Example: PDF Encryption

```bash
# Encrypt document
./mothrbox encrypt confidential_report.pdf "SecurePass2024"
# Output: 📦 Encrypted Blob ID: abc123xyz...

# Share blob ID via email, password via Signal/WhatsApp
# Recipient downloads and decrypts
./mothrbox decrypt abc123xyz... report.pdf "SecurePass2024"
```

---

## Storage Modes

MothrBox supports three encryption modes, each with different use cases.

### 1. AES-256-GCM (Default) ✅

**Best for:** General purpose, compliance requirements

```bash
./mothrbox encrypt file.txt "password"
./mothrbox decrypt <blob-id> output.txt "password"
```

**Features:**
- Industry-standard encryption
- Hardware-accelerated (Intel AES-NI)
- Authenticated encryption (prevents tampering)
- PBKDF2 key derivation (600,000 iterations)

**Security:**
- 256-bit key length
- Random 16-byte salt per encryption
- Random 12-byte nonce (IV) per encryption
- GCM authentication tag (prevents tampering)

### 2. ChaCha20-Poly1305

**Best for:** Mobile devices, systems without AES hardware acceleration

```bash
# Encrypt with ChaCha20
./mothrbox cli chacha encrypt /app/data/file.txt /app/data/file.enc "password"

# Upload to Walrus
./mothrbox cli walrus upload /app/data/file.enc
# Note: blob-id

# Download from Walrus
./mothrbox cli walrus download <blob-id> /app/data/downloaded.enc

# Decrypt
./mothrbox cli chacha decrypt /app/data/downloaded.enc /app/data/output.txt "password"
```

**Features:**
- Faster than AES on non-x86 architectures
- Simpler constant-time implementation
- Authenticated encryption (Poly1305 MAC)
- Mobile-friendly

### 3. ECC (Elliptic Curve Cryptography)

**Best for:** Sharing encrypted data without sharing passwords

```bash
# Generate key pair
./mothrbox keygen
# Creates: data/private.key, data/public.key

# Encrypt with recipient's public key (no password!)
./mothrbox cli ecc encrypt /app/data/file.txt /app/data/file.enc /app/data/public.key

# Upload to Walrus
./mothrbox cli walrus upload /app/data/file.enc
# Share blob-id publicly

# Recipient decrypts with their private key
./mothrbox cli walrus download <blob-id> /app/data/downloaded.enc
./mothrbox cli ecc decrypt /app/data/downloaded.enc /app/data/output.txt /app/data/private.key
```

**Features:**
- NIST P-256 elliptic curve
- Ephemeral ECDH (perfect forward secrecy)
- Hybrid encryption (ECC + AES-256-GCM)
- Public key sharing (no shared secret needed)

### Comparison Table

| Feature | AES-256-GCM | ChaCha20-Poly1305 | ECC |
|---------|-------------|-------------------|-----|
| Speed | Fast (hardware) | Fast (software) | Moderate |
| Security | ✅ Military-grade | ✅ Military-grade | ✅ Military-grade |
| Password-based | ✅ Yes | ✅ Yes | ❌ Key-based |
| Hardware accel | ✅ Yes | ❌ No | ❌ No |
| Mobile-friendly | Good | ✅ Excellent | Good |
| Use case | General | Performance | Sharing |

---

## 💡 Use Cases

### 1. Secure Document Sharing

**Scenario:** Share confidential reports with colleagues

```bash
# Alice encrypts and uploads
./mothrbox encrypt Q4_financials.pdf "SecretPass123"
# Blob ID: xyz789...

# Alice shares:
# - Blob ID via email: xyz789...
# - Password via Signal: SecretPass123

# Bob downloads and decrypts
./mothrbox decrypt xyz789... Q4_financials.pdf "SecretPass123"
```

**Why MothrBox:**
- No central server to hack
- End-to-end encrypted
- Blob ID can be shared publicly
- Password shared via separate channel

### 2. Personal Cloud Backup

**Scenario:** Backup important files with encryption

```bash
# Backup script
#!/bin/bash
PASSWORD="MyBackupPass2024"

for file in important_docs/*.pdf; do
    echo "Backing up: $file"
    ./mothrbox encrypt "$file" "$PASSWORD"
    # Save blob IDs to backup_inventory.txt
done
```

**Why MothrBox:**
- Encrypted before upload
- Decentralized storage (no single point of failure)
- Password-protected
- Can't lose data if one node fails

### 3. Journalist Source Protection

**Scenario:** Protect whistleblower documents

```bash
# Encrypt sensitive documents
./mothrbox encrypt leaked_documents.zip "JournalistPass!2024"
# Blob ID: abc123...

# Delete local copy immediately
shred -vfz -n 10 leaked_documents.zip

# Later: Retrieve when needed
./mothrbox decrypt abc123... working_copy.zip "JournalistPass!2024"
```

**Why MothrBox:**
- Censorship-resistant storage
- No central server to subpoena
- Encrypted at rest
- Distributed across nodes

### 4. Medical Records (HIPAA Compliance)

**Scenario:** Store patient records securely

```bash
# Encrypt patient data
./mothrbox encrypt patient_records_2024.csv "MedicalDB!Pass"

# Access control via password distribution
# Audit trail via Sui blockchain
# Encrypted at rest (HIPAA requirement)
```

**Why MothrBox:**
- HIPAA-compliant encryption (AES-256)
- Encrypted before transmission
- Decentralized storage
- Blockchain audit trail (Sui)

### 5. Developer SSH Key Backup

**Scenario:** Backup SSH keys to cloud

```bash
# Create backup
cd ~/.ssh
tar czf ssh_backup.tar.gz id_rsa id_rsa.pub config known_hosts

# Encrypt and upload
./mothrbox encrypt ssh_backup.tar.gz "SSHBackup2024!"
# Store blob ID in password manager

# Restore on new machine
./mothrbox decrypt <blob-id> ssh_restore.tar.gz "SSHBackup2024!"
tar xzf ssh_restore.tar.gz -C ~/.ssh/
```

**Why MothrBox:**
- Never store private keys unencrypted
- Decentralized backup
- Restore from any machine
- Password-protected

### 6. Legal Document Storage

**Scenario:** Long-term storage of legal documents

```bash
# Encrypt contracts
./mothrbox encrypt contract_2024.pdf "LegalVault!Pass"

# Walrus stores for 3 epochs (~30 days default)
# Can extend storage by re-uploading before expiry
```

**Why MothrBox:**
- Tamper-proof (authenticated encryption)
- Decentralized (no single point of failure)
- Blockchain metadata (proof of existence)
- Long-term storage capability

### 7. Research Data Archival

**Scenario:** Archive research datasets

```bash
# Encrypt research data
./mothrbox encrypt dataset_2024.tar.gz "ResearchPass2024"

# Share blob ID in published paper
# Other researchers can verify data integrity
```

**Why MothrBox:**
- Verifiable storage (Sui blockchain)
- Decentralized availability
- Encrypted for privacy
- Content-addressed (blob ID)

### 8. Multi-Party Data Exchange

**Scenario:** Multiple parties need access without shared password

```bash
# Generate key pairs for each party
./mothrbox keygen  # Alice's keys
./mothrbox keygen  # Bob's keys
./mothrbox keygen  # Carol's keys

# Encrypt once with each public key
./mothrbox cli ecc encrypt /app/data/shared_data.txt /app/data/for_bob.enc /app/data/bob_public.key
./mothrbox cli ecc encrypt /app/data/shared_data.txt /app/data/for_carol.enc /app/data/carol_public.key

# Upload both
./mothrbox cli walrus upload /app/data/for_bob.enc    # blob-id-1
./mothrbox cli walrus upload /app/data/for_carol.enc  # blob-id-2

# Each party decrypts with their own private key
# Bob: ./mothrbox cli ecc decrypt ...
# Carol: ./mothrbox cli ecc decrypt ...
```

**Why MothrBox:**
- No shared password needed
- Each party has unique key
- Can revoke access (don't share new encryptions)
- Public key cryptography

---

## Advanced Usage

### Batch Operations

```bash
# Encrypt multiple files
for file in *.txt; do
    ./mothrbox encrypt "$file" "BatchPass2024"
done

# Save blob IDs
./mothrbox encrypt file1.txt "pass" | tee -a blob_ids.log
./mothrbox encrypt file2.txt "pass" | tee -a blob_ids.log
```

### Integration with Scripts

```bash
#!/bin/bash
# Daily backup script

BACKUP_FILE="backup_$(date +%Y%m%d).tar.gz"
tar czf "$BACKUP_FILE" ~/important_files/

./mothrbox encrypt "$BACKUP_FILE" "$BACKUP_PASSWORD"
rm "$BACKUP_FILE"  # Remove unencrypted copy
```

### Testing Different File Types

```bash
# Text files
./mothrbox encrypt document.txt "pass"

# PDFs
./mothrbox encrypt report.pdf "pass"

# Images
./mothrbox encrypt photo.jpg "pass"

# Large files
./mothrbox encrypt video.mp4 "pass"

# Archives
./mothrbox encrypt backup.tar.gz "pass"
```

---

## FAQ

**Q: How secure is MothrBox?**
A: Uses AES-256-GCM (military-grade), PBKDF2 with 600K iterations, random salts/nonces. Same encryption standards as Signal, WhatsApp, and 1Password.

**Q: Where is my data stored?**
A: Distributed across Walrus Protocol nodes (decentralized network). Metadata stored on Sui blockchain.

**Q: Can I lose my data?**
A: Walrus uses erasure coding - data can be reconstructed even if some nodes fail. Default storage: 3 epochs (~30 days).

**Q: What if I forget my password?**
A: **Cannot be recovered.** Encryption is end-to-end - we never see your password. Store passwords in a password manager.

**Q: Is this production-ready?**
A: Hackathon prototype with solid cryptographic foundation. Needs production hardening (streaming, error recovery, rate limiting) for enterprise use.

**Q: How much does it cost?**
A: Testnet is free. Mainnet requires SUI tokens to pay for storage.

**Q: Can I delete my data?**
A: Yes, by default files are deletable. Use Walrus CLI to delete: `./mothrbox cli walrus delete <blob-id>`

---

## Troubleshooting

### Common Issues

**Docker not found:**
```bash
# Install Docker: https://docs.docker.com/get-docker/
docker --version
```

**Configuration missing:**
```bash
./mothrbox setup
```

**Wrong password:**
```bash
# Error: ❌ Decryption failed
# Solution: Use correct password, or file is corrupted
```

**Network issues:**
```bash
# Check Walrus connectivity
curl -I https://aggregator.walrus-testnet.walrus.space
```

**Out of SUI balance:**
```bash
# Testnet: Get free SUI
# Visit: https://faucet.testnet.sui.io/
# Paste your address (from wallet)
```

---

## Project Structure

```
mothrbox_v2/
├── Dockerfile                  # Single-image build
├── mothrbox                   # Main CLI wrapper
├── mothrbox_entrypoint.sh    # Docker entrypoint
├── mothrbox_rs/              # Rust encryption engine
│   └── src/
│       ├── encryption/       # AES, ChaCha20, ECC
│       └── walrus.rs         # Deno integration
├── mothrbox_ts/              # Deno Walrus client
│   └── src/
│       ├── walrus-client.ts  # Walrus SDK wrapper
│       └── walrus-cli.ts     # CLI interface
└── data/                     # User files (volume mount)
```

---

## Technical Details

**Encryption:** AES-256-GCM, ChaCha20-Poly1305, ECC P-256  
**Key Derivation:** PBKDF2 (600,000 iterations)  
**Storage:** Walrus Protocol (erasure coding)  
**Blockchain:** Sui (metadata)  
**Languages:** Rust, TypeScript  
**Runtime:** Docker, Deno  

**Full architecture:** See [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Contributing

This is a hackathon project. For improvements or issues, please contact the team.

---

## License

[Specify your license]

---

## Acknowledgments

- **Walrus Protocol** - Decentralized storage
- **Sui Foundation** - Blockchain infrastructure
- **Rust Community** - Cryptography libraries
- **Deno Team** - TypeScript runtime

---

**Built for secure, censorship-resistant storage** 🦋🔒