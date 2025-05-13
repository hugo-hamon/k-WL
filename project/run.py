from src.utils.message import log_error
from src.app import App
import argparse
import logging
import os

LOGGING_CONFIG = {
    "level": logging.INFO,
    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    "datefmt": "%d-%b-%y %H:%M:%S",
    "filename": "log/log.log",
    "filemode": "w",
}

DEFAULT_CONFIG_PATH = "config/default.toml"


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        prog="k-WL",
        description="k-WL web application",
    )
    parser.add_argument(
        "--config",
        "-c",
        metavar="CONFIG_FILE",
        type=str,
        default=DEFAULT_CONFIG_PATH,
        help="Path to the configuration file. If not provided, uses the default config.",
    )

    return parser.parse_args()


def process_config_path(config_path: str) -> str:
    """Process the config path."""
    variant = [
        config_path,
        f"config/{config_path}",
        f"config/{config_path}.toml",
        f"{config_path}.toml",
    ]
    for path in variant:
        if os.path.exists(path) and os.path.isfile(path):
            return path

    error_msg = (
        f"Le fichier de configuration '{config_path}' n'a pas été trouvé.\n"
        f"Les chemins suivants ont été essayés :\n"
        + "\n".join(f"- {path}" for path in variant)
        + "\n\nVeuillez vérifier que le fichier existe."
    )
    raise FileNotFoundError(error_msg)


if __name__ == "__main__":
    logger = logging.getLogger(__name__)
    logging.basicConfig(**LOGGING_CONFIG)
    logger.info("Starting run.py")

    try:
        args = parse_args()
        config_path = process_config_path(args.config)
        logger.info(f"Using config file {config_path}")
        app = App(config_path)
        app.run()
    except FileNotFoundError as e:
        log_error(
            f"Erreur de configuration : {str(e)}",
            logger,
        )
    except Exception as e:
        log_error(
            f"Une erreur inattendue s'est produite : {str(e)}",
            logger,
        )
