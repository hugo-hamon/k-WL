from .utils.message import log_error
from .config import load_config
import logging
import eel


class App:
    def __init__(self, config_path: str) -> None:
        self.config = load_config(config_path)
        self.logger = logging.getLogger(__name__)

    def run(self):
        try:
            eel.init("src/web")
            self.expose_functions()
            eel.start(
                "index.html",
                mode="firefox",
                cmdline_args=["--start-fullscreen"],
                shutdown_delay=3,
            )
        except Exception as e:
            self.logger.error(
                f"Erreur lors de l'initialisation de l'application: {str(e)}"
            )
            log_error(
                f"Erreur lors de l'initialisation de l'application: {str(e)}",
                self.logger,
            )

    def expose_functions(self) -> None:
        """Expose functions to JavaScript"""
        functions = self.__dir__()
        for function in functions:
            if function.startswith("eel_"):
                eel.expose(getattr(self, function))
