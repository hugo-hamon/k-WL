import logging


def log_error(message: str, logger: logging.Logger) -> None:
    """Log an error message and exit the program"""
    logger.error(message)
    print("Erreur: plus d'informations dans le fichier de log.")
    exit(1)
