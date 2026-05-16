import pytest

from app.lib.crypto import decrypt_field, encrypt_field


def test_crypto_round_trip():
    secret = "a" * 64
    ciphertext = encrypt_field("hello-world", secret)
    assert decrypt_field(ciphertext, secret) == "hello-world"


def test_crypto_rejects_tampered_ciphertext():
    secret = "a" * 64
    ciphertext = encrypt_field("hello-world", secret)
    tampered = ciphertext[:-2] + "AA"
    with pytest.raises(ValueError):
        decrypt_field(tampered, secret)


def test_crypto_rejects_wrong_key():
    secret = "a" * 64
    other_secret = "b" * 64
    ciphertext = encrypt_field("hello-world", secret)
    with pytest.raises(ValueError):
        decrypt_field(ciphertext, other_secret)
