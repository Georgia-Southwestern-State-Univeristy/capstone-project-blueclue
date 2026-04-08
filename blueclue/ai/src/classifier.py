try:
    import spacy
    SPACY_AVAILABLE = True
except Exception:
    SPACY_AVAILABLE = False
    
from typing import Dict, List, Tuple
import re

class TicketClassifier:
    def __init__(self, use_spacy=True):
        """Initialize the enhanced keyword-based ticket classifier."""
        self.use_spacy = use_spacy and SPACY_AVAILABLE
        if self.use_spacy:
            try:
                self.nlp = spacy.load("en_core_web_sm")
            except:
                print("Warning: spaCy model not available, using simple preprocessing")
                self.use_spacy = False
                self.nlp = None
        else:
            self.nlp = None
        
        # Define weighted keyword patterns for categories with subcategories
        # Format: {keyword: (weight, subcategory)}
        self.category_keywords = {
            "hardware": {
                # Computers & Laptops
                "laptop": (4.0, "computer"),   # raised: unambiguous hardware
                "computer": (3.0, "computer"),
                "desktop": (3.0, "computer"),
                "pc": (2.5, "computer"),
                "workstation": (2.5, "computer"),
                "machine": (1.5, "computer"),
                # Servers (physical server hardware in IT context)
                "server": (3.5, "server"),
                
                # Displays (weight 3.0)
                "screen": (3.0, "display"),
                "monitor": (3.0, "display"),
                "display": (3.0, "display"),
                "dual monitor": (3.5, "display"),
                "external display": (3.0, "display"),
                "flickering": (2.5, "display"),
                "black screen": (3.0, "display"),
                "no display": (3.0, "display"),
                
                # Input Devices (weight raised: mouse/keyboard are unambiguous hardware)
                "keyboard": (2.5, "peripheral"),
                "mouse": (4.0, "peripheral"),
                "trackpad": (2.5, "peripheral"),
                "touchpad": (2.5, "peripheral"),
                "keys stuck": (3.0, "peripheral"),
                "mouse not working": (3.5, "peripheral"),
                "wireless mouse": (4.0, "peripheral"),
                "usb keyboard": (2.5, "peripheral"),
                "wireless receiver": (3.0, "peripheral"),
                "receiver": (2.0, "peripheral"),
                # Peripheral-specific disconnect — high weight to beat network scoring
                "mouse disconnecting": (5.0, "peripheral"),
                "mouse keeps disconnecting": (6.0, "peripheral"),
                "keyboard disconnecting": (5.0, "peripheral"),
                "keyboard keeps disconnecting": (6.0, "peripheral"),
                
                # Printers & Scanners (weight raised: printer is always hardware)
                "printer": (4.5, "printer"),
                "print": (2.0, "printer"),
                "scanning": (2.5, "printer"),
                "scanner": (2.5, "printer"),
                "copier": (2.5, "printer"),
                "paper jam": (3.5, "printer"),
                "printing": (2.0, "printer"),
                "won't print": (4.5, "printer"),
                "print queue": (2.5, "printer"),
                # Printer+network context — device is still hardware even if wifi is mentioned
                "printer won't connect": (8.0, "printer"),
                "printer not connecting": (8.0, "printer"),
                "printer wifi": (7.0, "printer"),
                "printer connect": (6.0, "printer"),
                "printer offline": (6.0, "printer"),
                "add printer": (5.0, "printer"),
                "printer drivers": (5.0, "printer"),
                "printer not found": (5.0, "printer"),
                
                # Power & Battery (weight 2.5)
                "battery": (2.5, "power"),
                "power": (2.0, "power"),
                "charger": (2.5, "power"),
                "charging": (2.0, "power"),
                "won't turn on": (3.5, "power"),
                "won't boot": (3.5, "power"),
                "not booting": (3.5, "power"),
                "no bootable": (4.0, "power"),
                "bootable device": (4.0, "power"),
                "boot device": (4.0, "power"),
                "shuts off": (3.5, "power"),
                "shuts down": (3.0, "power"),
                "turns off": (3.0, "power"),
                "turning off": (3.0, "power"),
                "shutting off": (3.5, "power"),
                "powers off": (3.5, "power"),
                "randomly shuts": (4.0, "power"),
                "keeps turning off": (4.5, "power"),
                "runs for a few minutes": (4.0, "power"),
                "shuts completely off": (4.5, "power"),
                "no warning": (2.5, "power"),
                "black screen error": (3.5, "power"),
                "power adapter": (2.5, "power"),
                "dead battery": (3.0, "power"),
                "battery is dead": (3.5, "power"),
                "battery dead": (3.0, "power"),
                "not charging": (3.0, "power"),
                
                # Connectivity & Ports (weight 2.0)
                "cable": (1.5, "connectivity"),
                "port": (2.0, "connectivity"),
                "usb": (2.0, "connectivity"),
                "hdmi": (2.5, "connectivity"),
                "docking station": (3.0, "connectivity"),
                "usb port": (2.5, "connectivity"),
                "ethernet port": (2.5, "connectivity"),
                
                # Physical Damage (weight 3.5)
                "broken": (3.5, "damage"),
                "damaged": (3.5, "damage"),
                "cracked": (3.5, "damage"),
                "shattered": (3.5, "damage"),
                "physical damage": (4.0, "damage"),
                "water damage": (4.0, "damage"),
                "dropped": (3.0, "damage"),
                
                # General Hardware Terms (weight 1.5-2.0)
                "device": (1.5, "general"),
                "hardware": (3.0, "general"),
                "equipment": (2.0, "general"),
                "physical": (1.5, "general"),
                "malfunctioning": (2.5, "general"),
                "defective": (3.0, "general"),
            },
            
            "software": {
                # Operating Systems (weight 3.0)
                "windows": (3.0, "os"),
                "mac os": (3.0, "os"),
                "macos": (3.0, "os"),
                "operating system": (3.0, "os"),
                "os": (2.0, "os"),
                "system update": (2.5, "os"),
                "blue screen": (4.0, "os"),
                "bsod": (4.0, "os"),
                "windows update": (2.5, "os"),
                
                # Microsoft Office (weight 3.0)
                "microsoft": (2.0, "office"),
                "office": (2.5, "office"),
                "excel": (3.5, "office"),
                "word": (3.5, "office"),
                "outlook": (3.5, "office"),
                "powerpoint": (3.5, "office"),
                "teams": (3.5, "office"),
                "onedrive": (3.0, "office"),
                "sharepoint": (3.0, "office"),
                "office 365": (3.0, "office"),
                "m365": (3.0, "office"),
                
                # Web Browsers (weight 2.5)
                "chrome": (3.0, "browser"),
                "browser": (3.0, "browser"),
                "firefox": (3.0, "browser"),
                "edge": (3.0, "browser"),
                "safari": (3.0, "browser"),
                "internet explorer": (2.5, "browser"),
                "webpage": (2.0, "browser"),
                
                # Applications (weight 2.5)
                "application": (2.5, "application"),
                "app": (2.0, "application"),
                "program": (2.5, "application"),
                "software": (3.0, "application"),
                "adobe": (3.0, "application"),
                "acrobat": (3.0, "application"),
                "photoshop": (3.0, "application"),
                "zoom": (3.0, "application"),
                "slack": (3.0, "application"),
                
                # Installation & Updates (weight 2.5)
                "install": (2.5, "installation"),
                "installation": (2.5, "installation"),
                "update": (2.0, "installation"),
                "upgrade": (2.5, "installation"),
                "uninstall": (2.5, "installation"),
                "download": (2.0, "installation"),
                "patch": (2.5, "installation"),
                "reinstall": (3.0, "installation"),
                
                # Software Errors (weight 3.0)
                "crash": (3.5, "error"),
                "crashing": (3.5, "error"),
                "freezing": (3.0, "error"),
                "frozen": (3.0, "error"),
                "not responding": (3.5, "error"),
                "error message": (3.0, "error"),
                "error code": (3.0, "error"),
                "won't open": (3.0, "error"),
                "can't open": (3.0, "error"),
                "won't start": (3.0, "error"),
                "slow performance": (2.5, "error"),
                "running slow": (2.5, "error"),
                
                # Security Software (weight 2.5)
                "antivirus": (3.0, "security"),
                "firewall": (2.5, "security"),
                "virus": (3.5, "security"),
                "malware": (3.5, "security"),
                "security software": (3.0, "security"),
            },
            
            "network": {
                # WiFi & Wireless (weight 3.0)
                "wifi": (4.0, "wireless"),
                "wi-fi": (4.0, "wireless"),
                "wireless": (3.0, "wireless"),
                "wireless network": (3.5, "wireless"),
                "wifi password": (3.0, "wireless"),
                "can't find wifi": (3.5, "wireless"),
                
                # Internet Connectivity (weight 3.0)
                "internet": (3.5, "connectivity"),
                "connection": (2.5, "connectivity"),
                "network": (3.0, "connectivity"),
                "connectivity": (3.0, "connectivity"),
                "online": (2.0, "connectivity"),
                "offline": (3.0, "connectivity"),
                "no internet": (4.0, "connectivity"),
                "can't connect": (3.5, "connectivity"),
                "won't connect": (3.5, "connectivity"),
                "disconnect": (3.0, "connectivity"),
                "disconnecting": (3.0, "connectivity"),
                "disconnected": (3.0, "connectivity"),
                "keeps disconnecting": (3.5, "connectivity"),
                "losing connection": (3.5, "connectivity"),
                
                # VPN (weight 3.5)
                "vpn": (4.0, "vpn"),
                "virtual private network": (4.0, "vpn"),
                "remote access": (3.0, "vpn"),
                "can't connect to vpn": (4.0, "vpn"),
                "vpn not working": (4.0, "vpn"),
                
                # Network Hardware (weight 2.5)
                "router": (3.0, "hardware"),
                "modem": (3.0, "hardware"),
                "ethernet": (3.0, "hardware"),
                "network cable": (2.5, "hardware"),
                "switch": (2.5, "hardware"),
                "access point": (2.5, "hardware"),
                
                # Performance Issues (weight 2.5)
                "slow internet": (3.5, "performance"),
                "slow connection": (3.0, "performance"),
                "bandwidth": (2.5, "performance"),
                "latency": (2.5, "performance"),
                "speed": (2.0, "performance"),
                "buffering": (3.0, "performance"),
                "timeout": (2.5, "performance"),
                
                # Network Configuration (weight 2.0)
                "dns": (2.5, "configuration"),
                "ip address": (2.5, "configuration"),
                "dhcp": (2.0, "configuration"),
                "subnet": (2.0, "configuration"),
                "proxy": (2.5, "configuration"),
                
                # Network Shares & File Access (weight 3.0)
                "network share": (4.0, "share"),
                "shared folder": (4.0, "share"),
                "share folder": (4.0, "share"),
                "public share": (4.0, "share"),
                "public folder": (3.5, "share"),
                "file share": (4.0, "share"),
                "shared drive": (3.5, "share"),
                "mapped drive": (3.5, "share"),
                "network drive": (4.0, "share"),
                "shared resource": (3.0, "share"),
                "folder access": (3.5, "share"),
                "drive access": (3.5, "share"),
                "share": (2.0, "share"),
            },
            
            "login": {
                # Authentication (weight 4.0)
                "login": (4.0, "authentication"),
                "log in": (4.0, "authentication"),
                "sign in": (4.0, "authentication"),
                "signin": (4.0, "authentication"),
                "can't login": (4.5, "authentication"),
                "can't log in": (4.5, "authentication"),
                "unable to login": (4.5, "authentication"),
                "cannot login": (4.5, "authentication"),
                "login failed": (4.0, "authentication"),
                "authentication": (3.5, "authentication"),
                "authenticate": (3.0, "authentication"),
                
                # Password Issues (weight 4.0)
                "password": (4.0, "password"),
                "forgot password": (4.5, "password"),
                "reset password": (4.0, "password"),
                "change password": (3.5, "password"),
                "password expired": (4.0, "password"),
                "password reset": (4.0, "password"),
                "wrong password": (4.0, "password"),
                "incorrect password": (4.0, "password"),
                
                # Account Access (weight 3.5)
                "locked out": (4.5, "account"),
                "account locked": (4.5, "account"),
                "account is locked": (4.5, "account"),   # handles "my account is locked"
                "account disabled": (4.0, "account"),
                "access denied": (3.5, "account"),
                "can't access": (3.5, "account"),
                "no access": (3.5, "account"),
                "permissions": (2.5, "account"),
                
                # Credentials (weight 3.0)
                "username": (3.5, "credentials"),
                "credentials": (3.5, "credentials"),
                "user id": (3.0, "credentials"),
                "user account": (3.0, "credentials"),
                
                # Email Account Access (weight 3.5)
                "email account": (4.0, "email"),
                "email login": (4.0, "email"),
                "can't access email": (4.0, "email"),
                "email password": (3.5, "email"),
                
                # Multi-factor Authentication (weight 3.0)
                "mfa": (3.5, "mfa"),
                "2fa": (3.5, "mfa"),
                "two-factor": (3.5, "mfa"),
                "multi-factor": (3.5, "mfa"),
                "authenticator": (3.0, "mfa"),
                "verification code": (3.0, "mfa"),
            },
            
            "other": {
                # General Inquiries (weight 1.5)
                "question": (2.0, "inquiry"),
                "inquiry": (2.0, "inquiry"),
                "information": (1.5, "inquiry"),
                "wondering": (2.0, "inquiry"),
                "curious": (1.5, "inquiry"),
                "clarification": (2.0, "inquiry"),
                
                # Policy & Procedures (weight 2.0)
                "policy": (3.0, "policy"),
                "policies": (3.0, "policy"),
                "procedure": (2.5, "policy"),
                "guidelines": (2.0, "policy"),
                "rules": (2.0, "policy"),
                
                # General Terms (weight 1.0)
                "general": (1.5, "general"),
                "help": (1.0, "general"),
                "guidance": (1.5, "general"),
                "advice": (1.5, "general"),
            }
        }
        
        # Define multi-word phrases for better context matching
        self.category_phrases = {
            "hardware": [
                "laptop screen", "computer screen", "won't turn on", "won't boot",
                "paper jam", "won't print", "not charging", "black screen",
                "no display", "keys stuck", "mouse not working", "dual monitor",
                "docking station", "usb port", "power adapter", "water damage",
                "physical damage", "wireless receiver", "battery is dead",
                "battery dead", "spilled", "liquid damage", "server down",
                "server is down", "server has been down",
                # Printer phrases — keep printer issues in hardware even when wifi is mentioned
                "printer won't connect", "printer not connecting", "printer wifi",
                "printer connect", "printer offline", "add printer",
                "printer drivers", "printer not found", "printer is offline",
                "printer setup", "printer configuration",
                # Recurring shutdown / boot issues
                "shuts off", "turns off", "shuts down unexpectedly",
                "keeps turning off", "randomly shuts", "no bootable",
                "bootable device", "boot device not found",
            ],
            "software": [
                "blue screen", "won't open", "can't open", "not responding",
                "won't start", "error message", "error code", "slow performance",
                "running slow", "office 365", "windows update", "system update",
                "printer software", "printer driver", "software install",
                "driver install", "software won't install",
            ],
            "network": [
                "slow internet", "can't connect", "won't connect", "no internet",
                "keeps disconnecting", "losing connection", "wifi password",
                "can't find wifi", "can't connect to vpn", "vpn not working",
                "slow connection", "network cable", "access point",
                "network share", "shared folder", "share folder", "public share",
                "public folder", "file share", "shared drive", "mapped drive",
                "network drive", "folder access", "drive access"
            ],
            "login": [
                "can't login", "can't log in", "unable to login", "cannot login",
                "forgot password", "reset password", "change password", "locked out",
                "account locked", "account is locked", "access denied",
                "can't access", "no access",
                "email account", "email login", "can't access email", "wrong password",
                "incorrect password", "password expired", "login failed",
                "two-factor", "multi-factor", "verification code"
            ],
            "other": []
        }
        
        # Enhanced priority keywords with weights and sentiment indicators
        self.priority_keywords = {
            "high": {
                # Critical urgency (weight 5.0)
                "urgent": (5.0, "urgency"),
                "urgently": (5.0, "urgency"),
                "critical": (5.0, "urgency"),
                "emergency": (5.0, "urgency"),
                "asap": (5.0, "urgency"),
                "immediately": (5.0, "urgency"),
                "right now": (5.0, "urgency"),
                "as soon as possible": (5.0, "urgency"),
                
                # Business impact
                "production": (5.0, "business_impact"),
                "down": (4.5, "business_impact"),
                "can't work": (5.0, "business_impact"),
                "cannot work": (5.0, "business_impact"),
                "no one can work": (5.0, "business_impact"),
                "blocking": (2.5, "business_impact"),   # reduced: too generic alone
                "blocking my work": (5.0, "business_impact"),
                "blocking the team": (5.0, "business_impact"),
                "blocker": (4.5, "business_impact"),
                "system down": (5.0, "business_impact"),
                "server down": (5.0, "business_impact"),
                
                # Severity ("broken" alone is MEDIUM; escalate with modifier keywords)
                "not working at all": (4.5, "severity"),
                "completely broken": (5.0, "severity"),
                "major issue": (4.0, "severity"),
                "serious problem": (4.0, "severity"),
                # Account / access lockouts
                "locked out": (5.0, "account_lockout"),
                "account locked": (5.0, "account_lockout"),
                "account is locked": (5.0, "account_lockout"),
                # Credential failures
                "password expired": (4.5, "expired"),
                "credentials expired": (4.5, "expired"),
                # Application unresponsiveness
                "not responding": (4.0, "unresponsive"),
                "won't respond": (4.0, "unresponsive"),
                # Update / system failures
                "update failed": (4.0, "failure"),
                "failed to update": (4.0, "failure"),
                "system won't restart": (4.5, "failure"),
                # Repeated crash loop (raised 7.0 to beat MEDIUM issue+keeps combos)
                "keeps crashing": (7.0, "crash_loop"),
                "keeps restarting": (7.0, "crash_loop"),
                # Remote access completely down (high weight to beat MEDIUM combos)
                "remote access not working": (8.0, "remote"),
                "remote access down": (7.0, "remote"),
                # MFA / 2FA broken (blocks all access) — broad coverage
                "mfa not working": (4.5, "mfa"),
                "2fa not working": (4.5, "mfa"),
                "authenticator not working": (4.5, "mfa"),
                "authentication stopped working": (4.5, "mfa"),
                "multi-factor": (4.0, "mfa"),
                "two-factor": (4.0, "mfa"),
                "verification code": (3.5, "mfa"),
                # Liquid / physical damage — device largely unusable
                "spilled": (4.5, "damage"),
                "liquid damage": (5.0, "damage"),
                "water damage": (5.0, "damage"),
                # Battery completely dead — device unusable without power
                "battery is dead": (4.0, "power"),
                "battery dead": (3.5, "power"),
                "battery not charging": (4.5, "power"),
                "not charging": (4.0, "power"),
                # Email send/receive failure — work-blocking
                "won't send": (4.5, "email_failure"),
                "emails won't send": (5.0, "email_failure"),
                "won't send or receive": (5.0, "email_failure"),
                # VPN instability
                "keeps dropping": (4.5, "vpn"),
                "drops every": (4.0, "vpn"),
                # Business blocking — team / group impact
                "blocking my team": (5.0, "business_impact"),
                "blocking my whole team": (5.0, "business_impact"),
                "blocking everyone": (5.0, "business_impact"),
                "blocking all": (4.5, "business_impact"),
                # Right-away urgency phrasing
                "right away": (4.5, "urgency"),
                "need it now": (4.5, "urgency"),
                # Deadline-driven urgency
                "presentation in": (4.0, "deadline"),
                "meeting in": (4.0, "deadline"),
                "in 30 minutes": (5.0, "deadline"),
                "in an hour": (4.5, "deadline"),
                "deadline today": (5.0, "deadline"),
                "deadline this": (4.5, "deadline"),
                "have a deadline": (4.0, "deadline"),
                "has a deadline": (4.0, "deadline"),
                "won't turn on at all": (5.0, "power"),
                "doesn't turn on": (4.5, "power"),
                "computer won't turn on": (5.0, "power"),
                "won't start at all": (5.0, "power"),
            },
            
            "medium": {
                # Common issues (weight 3.0)
                "issue": (3.0, "issue"),
                "problem": (3.0, "issue"),
                "trouble": (3.0, "issue"),
                "difficulty": (2.5, "issue"),
                
                # Partial functionality (weight 3.5)
                "not working": (3.5, "functionality"),
                "won't work": (3.5, "functionality"),
                "can't": (3.0, "functionality"),
                "unable": (3.0, "functionality"),
                "won't": (3.0, "functionality"),
                "doesn't work": (3.5, "functionality"),
                "don't work": (3.0, "functionality"),
                "wont": (2.5, "functionality"),   # terse spelling without apostrophe
                "cant": (2.5, "functionality"),   # terse spelling
                # Device failure
                "broken": (3.0, "failure"),    # moved from HIGH; escalate with modifiers
                "broke": (3.0, "failure"),
                "won't turn on": (4.0, "power"),  # device can't start — MEDIUM not HIGH
                "defective": (3.0, "failure"),
                # Display issues
                "flickering": (3.0, "display"),
                "flickering badly": (3.5, "display"),
                # Access issues
                "forgot": (3.0, "access"),
                "frozen": (3.0, "freeze"),
                "freezes": (3.0, "freeze"),
                "freeze": (3.0, "freeze"),
                # Access / permissions
                "access denied": (3.5, "access"),
                "permissions": (2.5, "access"),
                "permission denied": (3.5, "access"),
                # Network availability
                "no internet": (3.5, "network"),
                "no internet access": (4.0, "network"),
                
                # Moderate urgency (kept very low — too generic on their own)
                "soon": (3.0, "urgency"),
                "today": (3.5, "urgency"),
                
                # Frequency/persistence — use specific HIGH phrases to avoid
                # false MEDIUM from "keeps" alone + another word
                "repeatedly": (3.0, "frequency"),
                "constantly": (3.5, "frequency"),
                "always": (3.0, "frequency"),
                "disconnecting": (3.0, "frequency"),
            },
            
            "low": {
                # Questions (weight 1.5)
                "question": (2.0, "inquiry"),
                "wondering": (2.0, "inquiry"),
                "curious": (1.5, "inquiry"),
                "interested": (1.5, "inquiry"),

                # Flexible timing — explicit low-urgency signals override other keywords
                "when you get a chance": (4.5, "timing"),
                "when possible": (3.5, "timing"),
                "sometime": (2.5, "timing"),
                "eventually": (2.5, "timing"),
                "no rush": (3.0, "timing"),
                "not urgent": (3.5, "timing"),

                # General/informational (weight 1.5)
                "general": (2.0, "general"),
                "policy": (2.0, "general"),
                "policies": (2.0, "general"),
                "information": (1.5, "general"),
                "guidance": (1.5, "general"),

                # Performance / cosmetic issues (slow/buffers don't block work)
                "slow": (3.0, "performance"),
                "running slow": (3.0, "performance"),
                "buffering": (3.0, "performance"),
                "lagging": (2.5, "performance"),
                "optimize": (2.5, "performance"),
                "optimizing": (2.5, "performance"),
                "optimization": (2.0, "performance"),
                "performance issue": (3.0, "performance"),
                "running slowly": (3.0, "performance"),

                # False-urgency prevention — requests that use urgent words but
                # describe trivially non-blocking asks (equipment, inquiries, schedules).
                # Weighted >= 5.5 so they neutralise a single "urgent"/"asap" signal.
                "can i get a new": (5.5, "false_urgency"),  # "ASAP: can I get a new mouse"
                "can we get a new": (5.5, "false_urgency"),
                "get a new mouse": (5.5, "false_urgency"),
                "get a new keyboard": (5.5, "false_urgency"),
                "get a new monitor": (5.5, "false_urgency"),
                "a bit old": (5.0, "false_urgency"),         # "mine is a bit old"
                "mine is old": (5.0, "false_urgency"),
                "choosing between": (5.5, "false_urgency"),  # purchasing inquiry
                "which model": (4.5, "false_urgency"),
                "when is the next": (5.5, "false_urgency"),  # scheduling inquiry
                "training session": (4.5, "training"),
                "it training": (4.5, "training"),
                "next training": (5.0, "training"),
            }
        }
        
        # Negative sentiment words that might lower priority
        self.negative_modifiers = ["not urgent", "no rush", "when you can", "low priority"]
        
        # Positive sentiment/urgency boosters
        self.urgency_boosters = ["now", "today", "asap", "urgent", "critical", "emergency", "immediately"]
        
        # Common abbreviations and shorthand for terse messages
        self.abbreviations = {
            "pc": "computer",
            "comp": "computer",
            "puter": "computer",
            "lappy": "laptop",
            "cant": "can't",
            "wont": "won't",
            "doesnt": "doesn't",
            "isnt": "isn't",
            "pls": "please",
            "plz": "please",
            "thx": "thanks",
            "u": "you",
            "ur": "your",
            "pw": "password",
            "pwd": "password",
            "acct": "account",
            "msg": "message",
            "pwr": "power",
            "batt": "battery",
            "wifi": "wifi",
            "inet": "internet",
            "net": "network",
            "prtr": "printer",
            "scrn": "screen",
            "mon": "monitor",
            "kb": "keyboard",
            "kboard": "keyboard"
        }
    
    def preprocess_text(self, text: str) -> str:
        """Normalize and clean the input text, handling abbreviations."""
        text_lower = text.lower()
        
        # Expand common abbreviations
        words = text_lower.split()
        expanded_words = [self.abbreviations.get(word, word) for word in words]
        text_expanded = " ".join(expanded_words)
        
        if self.use_spacy and self.nlp:
            doc = self.nlp(text_expanded)
            # Remove stopwords and lemmatize
            tokens = [token.lemma_ for token in doc if not token.is_stop and not token.is_punct]
            return " ".join(tokens)
        else:
            # Simple preprocessing without spacy
            return text_expanded
    
    def _match_phrases(self, text: str, category: str) -> List[Tuple[str, float]]:
        """Match multi-word phrases for better context awareness."""
        matches = []
        text_lower = text.lower()
        
        for phrase in self.category_phrases.get(category, []):
            if phrase in text_lower:
                # Phrase matches get bonus weight
                base_weight = self.category_keywords[category].get(phrase, (2.0, "general"))[0]
                phrase_bonus = 1.5  # 50% bonus for phrase matches
                matches.append((phrase, base_weight * phrase_bonus))
        
        return matches
    
    def classify_category(self, text: str) -> Tuple[str, float, bool, List[str], str, List[Dict]]:
        """
        Classify ticket category using weighted keywords and phrase matching.
        
        Returns:
            Tuple of (category, confidence, fallback_used, keywords_matched, subcategory, all_categories)
        """
        processed_text = self.preprocess_text(text)
        original_lower = text.lower()
        
        category_scores = {}
        matched_keywords = {}
        subcategory_scores = {}
        
        for category, keywords_dict in self.category_keywords.items():
            score = 0.0
            matches = []
            subcat_scores = {}
            
            # Match single keywords with weights
            for keyword, (weight, subcategory) in keywords_dict.items():
                if keyword in original_lower or keyword in processed_text:
                    score += weight
                    matches.append(keyword)
                    # Track subcategory scores
                    subcat_scores[subcategory] = subcat_scores.get(subcategory, 0) + weight
            
            # Match multi-word phrases
            phrase_matches = self._match_phrases(text, category)
            for phrase, phrase_weight in phrase_matches:
                if phrase not in matches:  # Avoid double-counting
                    score += phrase_weight
                    matches.append(phrase)
            
            category_scores[category] = score
            matched_keywords[category] = matches
            if subcat_scores:
                subcategory_scores[category] = max(subcat_scores, key=subcat_scores.get)
        
        # Get all categories sorted by score for multi-category detection
        all_categories = [
            {
                "category": cat,
                "score": score,
                "confidence": min(score / 10.0, 1.0),  # Normalize to 0-1
                "keywords": matched_keywords[cat],
                "subcategory": subcategory_scores.get(cat, "general")
            }
            for cat, score in category_scores.items()
            if score > 0
        ]
        all_categories.sort(key=lambda x: x["score"], reverse=True)
        
        # Find best match
        if category_scores and max(category_scores.values()) > 0:
            best_category = max(category_scores, key=category_scores.get)
            best_score = category_scores[best_category]
            
            # Enhanced confidence calculation
            # Base: score / 10 (assumes ~10 points is high confidence)
            # Adjusted by keyword diversity and phrase matches
            num_matches = len(matched_keywords[best_category])
            confidence = min((best_score / 10.0) * (1 + num_matches * 0.05), 1.0)
            
            subcategory = subcategory_scores.get(best_category, "general")
            
            return (best_category, confidence, False, 
                   matched_keywords[best_category], subcategory, all_categories)
        
        # Fallback
        return "other", 0.3, True, [], "general", []
    
    def _calculate_sentiment_score(self, text: str) -> float:
        """Calculate basic sentiment/urgency score from text."""
        text_lower = text.lower()
        score = 0.0
        
        # Check for urgency boosters
        for booster in self.urgency_boosters:
            if booster in text_lower:
                score += 1.5
        
        # Check for negative modifiers (reduce urgency)
        for modifier in self.negative_modifiers:
            if modifier in text_lower:
                score -= 2.0
        
        # Check for exclamation marks (indicates urgency/emotion)
        score += text.count('!') * 0.5
        
        # Check for all caps words (indicates urgency/frustration)
        words = text.split()
        caps_words = [w for w in words if w.isupper() and len(w) > 2]
        score += len(caps_words) * 0.5
        
        return score
    
    def classify_priority(self, text: str, category: str = None) -> Tuple[str, List[str], float]:
        """
        Classify ticket priority using weighted keywords and sentiment analysis.
        
        Args:
            text: Ticket description
            category: Detected category (can influence priority)
            
        Returns:
            Tuple of (priority, keywords_matched, confidence)
        """
        original_lower = text.lower()
        # Also check abbreviation-expanded text so terse inputs like
        # "pc wont turn on" and "cant log in" score correctly.
        processed_text = self.preprocess_text(text)
        
        priority_scores = {
            "high": 0.0,
            "medium": 0.0,
            "low": 0.0
        }
        matched_keywords = {
            "high": [],
            "medium": [],
            "low": []
        }
        
        # Calculate weighted scores for each priority level
        for priority, keywords_dict in self.priority_keywords.items():
            for keyword, (weight, context) in keywords_dict.items():
                if keyword in original_lower or keyword in processed_text:
                    priority_scores[priority] += weight
                    matched_keywords[priority].append(keyword)
        
        # Add sentiment/urgency score
        sentiment_score = self._calculate_sentiment_score(text)
        
        # Apply sentiment to high priority
        if sentiment_score > 2:
            priority_scores["high"] += sentiment_score
        elif sentiment_score < -1:
            priority_scores["low"] += abs(sentiment_score)
        
        # Category-based priority adjustments
        if category == "login" and "locked out" in original_lower:
            priority_scores["high"] += 2.0  # Locked accounts are typically urgent
        
        if category == "hardware" and any(word in original_lower for word in ["broken", "damaged", "shattered"]):
            priority_scores["high"] += 1.5  # Physical damage is often urgent
        
        # Determine priority based on scores
        max_score = max(priority_scores.values())
        
        if max_score == 0:
            # No priority keywords found - use smart defaults based on issue type
            # Default to LOW for routine/common issues without urgency indicators
            default_priority = "low"
            
            # Certain phrases indicate MEDIUM priority (actual work-blocking issues)
            medium_default_indicators = [
                "not working", "doesn't work", "won't work", "can't access",
                "unable to", "failed to", "keeps failing", "constantly", "repeatedly",
                "don't work", "wont", "cant",
            ]
            
            # Check for medium indicators - must be phrases, not just "error"
            if any(indicator in original_lower for indicator in medium_default_indicators):
                default_priority = "medium"
            
            return default_priority, [], 0.5
        
        best_priority = max(priority_scores, key=priority_scores.get)
        
        # Calculate confidence
        total_score = sum(priority_scores.values())
        if total_score > 0:
            confidence = priority_scores[best_priority] / total_score
        else:
            confidence = 0.3
        
        return best_priority, matched_keywords[best_priority], confidence
    
    def classify(self, ticket_text: str, subject: str = None) -> Dict:
        """
        Classify a ticket's category and priority with enhanced features.

        Args:
            ticket_text: The ticket description text
            subject: Optional subject / title line.  When provided its keywords
                     are counted twice (2x weighting) relative to the body,
                     reflecting the fact that agents deliberately choose precise
                     subject lines.

        Returns:
            Dictionary with classification results including:
            - category: Primary category
            - priority: AI-predicted priority level
            - confidence: Overall confidence score
            - subcategory: Specific subcategory within main category
            - all_categories: List of all matching categories with scores
            - keywords_matched: Keywords that triggered the classification
            - fallback_used: Whether fallback classification was used
            - subject_used: Whether a subject line was provided
        """
        # Build combined text: prepend the subject twice so its keywords are
        # weighted 2x versus the description body.
        if subject and subject.strip():
            combined_text = f"{subject} {subject} {ticket_text}"
        else:
            combined_text = ticket_text

        # Classify category with multi-category support
        category, cat_confidence, fallback_used, cat_keywords, subcategory, all_categories = \
            self.classify_category(combined_text)

        # Classify priority with category context based on content only
        priority, pri_keywords, pri_confidence = self.classify_priority(combined_text, category)
        
        # Calculate overall confidence (weighted average)
        overall_confidence = (cat_confidence * 0.6 + pri_confidence * 0.4)
        
        # Determine if this might be a multi-category ticket
        is_multi_category = len(all_categories) > 1 and \
                           all_categories[1]["confidence"] > 0.3 if len(all_categories) > 1 else False
        
        result = {
            "category": category,
            "priority": priority,
            "confidence": round(overall_confidence, 2),
            "category_confidence": round(cat_confidence, 2),
            "priority_confidence": round(pri_confidence, 2),
            "subcategory": subcategory,
            "fallback_used": fallback_used,
            "is_multi_category": is_multi_category,
            "all_categories": all_categories[:3],  # Return top 3 categories
            "keywords_matched": {
                "category": cat_keywords,
                "priority": pri_keywords
            },
            "subject_used": bool(subject and subject.strip()),
        }

        return result
