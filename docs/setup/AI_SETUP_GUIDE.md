# AI Module Setup Guide

This guide will help you set up the AI module development environment on your local machine.

## Prerequisites

- **Python 3.12.10** (NOT 3.14 - spaCy compatibility issue)
- **Git** (to clone the repository)
- **Windows PowerShell** or Command Prompt

---

## Step 1: Install Python 3.12.10

### Download Python
1. Go to: https://www.python.org/downloads/release/python-31210/
2. Scroll to "Files" section
3. Download **"Windows installer (64-bit)"** → `python-3.12.10-amd64.exe`

### Install Python
1. Run the downloaded `.exe` file
2. **IMPORTANT:** Check ✅ "Add python.exe to PATH"
3. Click "Install Now"
4. Wait for installation to complete

### Verify Installation
Open a **new** PowerShell terminal and run:
```powershell
py -0
```

You should see Python 3.12 listed. Example output:
```
-V:3.14[-64] *   Python 3.14.2
-V:3.12[-64]     Python 3.12.10
```

---

## Step 2: Clone Repository & Navigate to AI Directory

```powershell
# Navigate to the project root (if not already there)
cd C:\BlueClue\capstone-project-blueclue\capstone-project-blueclue

# Navigate to the AI module
cd blueclue\ai
```

---

## Step 3: Create Virtual Environment

Create an isolated Python environment using Python 3.12:

```powershell
py -3.12 -m venv venv
```

This creates a `venv/` folder in the `ai/` directory.

---

## Step 4: Activate Virtual Environment

**Windows PowerShell:**
```powershell
.\venv\Scripts\Activate.ps1
```

**Windows Command Prompt:**
```cmd
.\venv\Scripts\activate.bat
```

**Success indicator:** Your terminal prompt should now show `(venv)` at the beginning:
```
(venv) PS C:\BlueClue\...\blueclue\ai>
```

---

## Step 5: Upgrade pip

Always upgrade pip first to avoid installation issues:

```powershell
python -m pip install --upgrade pip
```

---

## Step 6: Install Dependencies

Install all required packages from `requirements.txt`:

```powershell
pip install -r requirements.txt
```

This will install:
- Flask (web framework)
- spaCy (NLP library)
- python-dotenv (environment variables)
- requests (HTTP library)
- And all their dependencies

**Expected time:** 1-3 minutes depending on internet speed.

---

## Step 7: Download spaCy Language Model

Download the English language model for spaCy:

```powershell
python -m spacy download en_core_web_sm
```

**Success message:**
```
✔ Download and installation successful
You can now load the package via spacy.load('en_core_web_sm')
```

---

## Step 8: Verify Installation

Run the test suite to ensure everything is working:

```powershell
cd tests
python test_classifier.py
```

**Note:** If you see Pylance import warnings in VS Code, this is normal and won't affect functionality. The code uses dynamic path resolution which Pylance may not recognize immediately. The tests will still pass.

**Expected output:**
```
=== Ticket Classification Test ===

Ticket 1:
Text: My application keeps crashing when I try to login. This is urgent!
Category: technical ✓
Priority: high ✓
...

=== Results ===
Accuracy: 75.0%
Passed: 3/4
✓ Test PASSED (≥70% accuracy)
```

If you see the above output with **≥70% accuracy**, you're all set! ✅

---

## Step 9: Configure VS Code (Optional but Recommended)

### Select Python Interpreter
1. Press `Ctrl+Shift+P`
2. Type "Python: Select Interpreter"
3. Choose the one at: `.\blueclue\ai\venv\Scripts\python.exe`

### Benefits:
- IntelliSense autocomplete for installed packages
- Automatic virtual environment activation in new terminals
- Better debugging experience

---

## Common Issues & Troubleshooting

### Issue 1: "Python 3.12 not found"
**Solution:** Make sure you installed Python 3.12.10 (not 3.12.12 which has no installer). Verify with `py -0`.

### Issue 2: "spaCy installation fails"
**Cause:** Using Python 3.14 instead of 3.12
**Solution:** Delete `venv/` folder and recreate with Python 3.12:
```powershell
Remove-Item -Recurse -Force venv
py -3.12 -m venv venv
```

### Issue 3: "cannot be loaded because running scripts is disabled"
**Cause:** PowerShell execution policy restriction
**Solution:** Run PowerShell as Administrator and execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Issue 4: "'python' is not recognized"
**Cause:** Virtual environment not activated
**Solution:** Run `.\venv\Scripts\Activate.ps1` from the `ai/` directory

### Issue 5: "Module 'spacy' has no attribute 'load'"
**Cause:** spaCy model not downloaded
**Solution:** Run `python -m spacy download en_core_web_sm`

---

## Daily Workflow

Every time you work on the AI module:

1. **Navigate to AI directory:**
   ```powershell
   cd blueclue\ai
   ```

2. **Activate virtual environment:**
   ```powershell
   .\venv\Scripts\Activate.ps1
   ```

3. **Work on your code** (the `(venv)` indicator confirms you're in the right environment)

4. **Deactivate when done** (optional):
   ```powershell
   deactivate
   ```

---

## Important Notes

### ⚠️ DO NOT commit `venv/` folder to Git
The `venv/` folder is already in `.gitignore`. This folder contains thousands of files and should never be pushed to the repository.

### ✅ DO commit these files:
- `requirements.txt` (dependency list)
- `*.py` files (your code)
- Configuration files

### 📦 When pulling updates:
If `requirements.txt` changes, reinstall dependencies:
```powershell
pip install -r requirements.txt
```

---

## Quick Reference Commands

| Task | Command |
|------|---------|
| Create venv | `py -3.12 -m venv venv` |
| Activate venv | `.\venv\Scripts\Activate.ps1` |
| Deactivate venv | `deactivate` |
| Install packages | `pip install -r requirements.txt` |
| Add new package | `pip install <package-name>` |
| Update requirements | `pip freeze > requirements.txt` |
| Run tests | `python tests/test_classifier.py` |
| Check Python version | `python --version` |

---

## Need Help?

- Check the [CHANGELOG.md](../../blueclue/ai/CHANGELOG.md) for recent changes
- Ask in the team Slack/Discord channel
- Review Python/spaCy documentation

---

**Setup complete! You're ready to develop AI features for BlueClue.** 🎉
