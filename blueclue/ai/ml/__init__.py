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

from .data_exporter import DataExporter
from .synthetic_generator import SyntheticDataGenerator
from .preprocessor import DataPreprocessor
from .feature_extractor import FeatureExtractor
from .data_splitter import DataSplitter
from .eda import EDAReporter

__all__ = [
    "DataExporter",
    "SyntheticDataGenerator", 
    "DataPreprocessor",
    "FeatureExtractor",
    "DataSplitter",
    "EDAReporter"
]
