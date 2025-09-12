from dataclasses import dataclass
from dacite.core import from_dict
import toml



@dataclass
class EEL:
    open_browser_on_start: bool


@dataclass
class Config:
    eel: EEL


def load_config(config_path: str) -> Config:
    """Load the config"""
    return from_dict(data_class=Config, data=toml.load(config_path))
