from __future__ import annotations

import base64
import hashlib
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _derive_key(key: str) -> bytes:
    return hashlib.sha256(key.encode("utf-8")).digest()


def encrypt_field(plaintext: str, key: str) -> str:
    aes_key = _derive_key(key)
    nonce = os.urandom(12)
    ciphertext = AESGCM(aes_key).encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_field(ciphertext: str, key: str) -> str:
    aes_key = _derive_key(key)
    try:
        payload = base64.urlsafe_b64decode(ciphertext.encode("utf-8"))
        nonce, encrypted = payload[:12], payload[12:]
        plaintext = AESGCM(aes_key).decrypt(nonce, encrypted, None)
        return plaintext.decode("utf-8")
    except Exception as exc:
        raise ValueError("Invalid encrypted field") from exc
