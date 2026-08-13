import getpass

from .security import hash_password


def main() -> None:
    password = getpass.getpass("ArcMind login password: ")
    confirmation = getpass.getpass("Confirm password: ")
    if password != confirmation:
        raise SystemExit("passwords do not match")
    if len(password) < 8:
        raise SystemExit("password must contain at least 8 characters")
    print(hash_password(password))


if __name__ == "__main__":
    main()
