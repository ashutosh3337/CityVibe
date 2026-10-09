import sys
import os

# Ensure parent directory is in path so dataset.py and app.py can be imported seamlessly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
