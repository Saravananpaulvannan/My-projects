from getpass import getpass

from pwdlib import PasswordHash


password = getpass("Admin password: ")
if len(password) < 12:
    raise SystemExit("Use an admin password with at least 12 characters.")
print(PasswordHash.recommended().hash(password))