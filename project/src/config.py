from dataclasses import dataclass
from dacite.core import from_dict
import toml


@dataclass
class Config:
    pass


def load_config(config_path: str) -> Config:
    """Load the config"""
    return from_dict(data_class=Config, data=toml.load(config_path))
