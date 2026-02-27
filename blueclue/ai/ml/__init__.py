"""
BlueClue ML Module
==================

Machine Learning data pipeline for ticket classification.

This module provides utilities for:
- Exporting ticket data from PostgreSQL
- Generating synthetic training data
- Preprocessing and cleaning data
- Feature extraction and engineering
- Train/val/test data splitting
- Exploratory Data Analysis (EDA)
"""

__version__ = "1.0.0"
__author__ = "BlueClue Team"

# Lazy imports – heavy / DB-dependent modules are only loaded when accessed
# so the inference server can start without psycopg2 installed.
from .preprocessor import DataPreprocessor
from .feature_extractor import FeatureExtractor

__all__ = [
    "DataExporter",
    "SyntheticDataGenerator",
    "DataPreprocessor",
    "FeatureExtractor",
    "DataSplitter",
    "EDAReporter",
]


def __getattr__(name: str):
    """Lazy-load modules that require optional dependencies (e.g. psycopg2)."""
    if name == "DataExporter":
        from .data_exporter import DataExporter
        return DataExporter
    if name == "SyntheticDataGenerator":
        from .synthetic_generator import SyntheticDataGenerator
        return SyntheticDataGenerator
    if name == "DataSplitter":
        from .data_splitter import DataSplitter
        return DataSplitter
    if name == "EDAReporter":
        from .eda import EDAReporter
        return EDAReporter
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
