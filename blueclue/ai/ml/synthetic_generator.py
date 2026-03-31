"""
Synthetic Data Generator Module
================================

Generates realistic synthetic IT support ticket data for model training.
Since real data may not be available in sufficient quantity, this module
creates balanced, realistic ticket data based on domain knowledge.
"""

import os
import json
import csv
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import hashlib


class SyntheticDataGenerator:
    """
    Generates synthetic IT support ticket data for ML training.
    
    Creates realistic tickets across all categories and priorities
    with natural language descriptions and appropriate metadata.
    
    Usage:
        generator = SyntheticDataGenerator(seed=42)
        tickets = generator.generate(n_samples=1000)
        generator.save_to_csv(tickets, 'synthetic_tickets.csv')
    """
    
    # Category definitions with realistic ticket templates
    CATEGORIES = {
        "hardware": {
            "weight": 0.15,  # 15% of tickets
            "subcategories": ["computer", "display", "peripheral", "printer", "power", "connectivity", "damage"],
            "templates": [
                # Computer issues
                ("My {device} won't turn on", "I tried to power on my {device} this morning but nothing happens. The power light doesn't come on and there's no response when I press the power button. I've checked the power cable and it seems connected properly.", ["computer"], "high"),
                ("Computer running extremely slow", "My {device} has become incredibly slow over the past week. Applications take forever to open and the system freezes frequently. I've tried restarting but the issue persists.", ["computer"], "medium"),
                ("{device} making strange noise", "My {device} is making a loud clicking/grinding noise. It started yesterday and seems to be coming from inside the case. I'm worried about data loss.", ["computer"], "high"),
                ("Blue screen errors on my computer", "I keep getting blue screen errors that force my computer to restart. It happens randomly, sometimes twice a day. The error code is different each time.", ["computer"], "high"),
                
                # Display issues
                ("Monitor not displaying image", "My monitor shows 'No Signal' even though my computer is on. I've tried different cables but the same issue occurs.", ["display"], "medium"),
                ("Screen flickering constantly", "My {display} screen keeps flickering every few seconds. It's giving me headaches and making it impossible to work.", ["display"], "medium"),
                ("Second monitor not detected", "I connected a second monitor to my laptop but {os} doesn't detect it. I've tried the display settings but only shows one monitor.", ["display"], "low"),
                ("Cracked laptop screen", "I accidentally dropped my laptop and now the screen is cracked. There are lines across the display and part of it is black.", ["display", "damage"], "high"),
                
                # Peripheral issues
                ("Keyboard not working", "My {keyboard} stopped working suddenly. Some keys don't respond at all while others type random characters.", ["peripheral"], "medium"),
                ("Mouse cursor jumping around", "My mouse cursor keeps jumping to random positions on the screen. I've tried cleaning the sensor but the problem continues.", ["peripheral"], "low"),
                ("Wireless headset not connecting", "My wireless headset won't connect to my computer via Bluetooth. It was working fine yesterday.", ["peripheral"], "low"),
                
                # Printer issues
                ("Printer not printing", "When I try to print, the job gets stuck in the queue. The printer shows as online but nothing comes out.", ["printer"], "medium"),
                ("Paper jam in printer", "The printer keeps showing a paper jam error but I've checked and there's no paper stuck. Cleared the tray multiple times.", ["printer"], "low"),
                ("Print quality is poor", "My printed documents are coming out with streaks and faded areas. I've replaced the cartridge but the problem persists.", ["printer"], "low"),
                
                # Power issues
                ("Laptop battery draining quickly", "My laptop battery used to last 6 hours but now it dies in less than 2 hours. The battery health shows {percent}%.", ["power"], "medium"),
                ("Computer shuts down randomly", "My computer shuts down without warning. It happens at random times, sometimes after just 10 minutes of use.", ["power"], "high"),
                ("Laptop not charging", "My laptop is plugged in but shows 'plugged in, not charging'. The battery percentage stays at {percent}% and doesn't increase.", ["power"], "medium"),
                
                # Damage
                ("Water spilled on laptop", "I accidentally spilled water on my laptop. I turned it off immediately but now it won't start.", ["damage"], "critical"),
                ("Dropped external hard drive", "I dropped my external hard drive and now my computer doesn't recognize it when I plug it in.", ["damage"], "high"),
            ],
            "devices": ["laptop", "desktop", "workstation", "computer", "PC"],
            "keyboards": ["keyboard", "wireless keyboard", "USB keyboard"],
            "displays": ["monitor", "screen", "display"],
        },
        
        "software": {
            "weight": 0.20,  # 20% of tickets
            "subcategories": ["os", "office", "browser", "application", "installation", "error", "security"],
            "templates": [
                # OS issues
                ("{os} update failed", "I tried to install the latest {os} update but it failed with error code {error_code}. The system keeps prompting me to update but it fails every time.", ["os"], "medium"),
                ("{os} won't boot", "After a restart, {os} won't boot. It gets stuck on the loading screen and never progresses to the login.", ["os"], "critical"),
                ("System running slow after update", "Ever since the last {os} update, my computer has been extremely slow. Applications take minutes to load.", ["os"], "medium"),
                
                # Office issues
                ("{office_app} crashes when opening files", "{office_app} crashes every time I try to open a specific file. I've tried repairing Office but the issue continues.", ["office"], "high"),
                ("Can't save documents in {office_app}", "When I try to save in {office_app}, I get an error message saying the file is in use by another program.", ["office"], "medium"),
                ("{office_app} formulas not calculating", "My {office_app} spreadsheet formulas are showing the formula text instead of calculating. I haven't changed any settings.", ["office"], "medium"),
                ("Outlook not syncing emails", "Outlook stopped syncing new emails. It shows connected but no new messages appear even though I can see them on webmail.", ["office"], "high"),
                ("Teams calls dropping frequently", "My Microsoft Teams calls keep dropping after a few minutes. The audio cuts out and then I get disconnected.", ["office"], "high"),
                
                # Browser issues
                ("{browser} not loading pages", "{browser} shows 'This site can't be reached' for every website I try to visit. Other browsers work fine.", ["browser"], "medium"),
                ("Browser extremely slow", "My {browser} has become very slow. Pages take 30+ seconds to load and tabs crash frequently.", ["browser"], "low"),
                ("Can't download files from browser", "When I try to download files in {browser}, nothing happens. The download doesn't start.", ["browser"], "low"),
                
                # Application issues
                ("{app} won't open", "When I try to launch {app}, nothing happens. I've tried running as administrator but it still won't open.", ["application"], "medium"),
                ("Application freezing randomly", "{app} freezes randomly during use. I have to force close it and lose my unsaved work.", ["application"], "medium"),
                ("{app} showing error on startup", "Every time I open {app}, I get an error message: '{random_error}'. The application still opens but I'm worried.", ["application"], "low"),
                
                # Installation issues
                ("Can't install software", "I'm trying to install {app} but the installation fails with error: {error_code}", ["installation"], "medium"),
                ("Need software installed", "I need {app} installed on my computer for a new project. I don't have admin rights to install it myself.", ["installation"], "low"),
                ("Software license expired", "My {app} license has expired and I can no longer access the software. I need it for my daily work.", ["installation"], "high"),
                
                # Security
                ("Antivirus blocking application", "My antivirus is blocking {app} from running. I've tried adding an exception but it still blocks it.", ["security"], "medium"),
                ("Suspicious popup messages", "I keep getting popup messages even when no browser is open. They ask me to call a number for support.", ["security"], "critical"),
                ("Computer infected with virus", "I think my computer has a virus. It's running slow, showing popups, and my homepage changed without my doing.", ["security"], "critical"),
                # Critical — data loss / ransomware / complete system failure
                ("Ransomware detected — files encrypted", "We have detected ransomware on multiple systems. Files are being encrypted and we see ransom notes appearing. We have isolated affected machines but need immediate incident response.", ["security"], "critical"),
                ("Database or file server data corruption", "Our database appears to be corrupted following an unclean shutdown. Several tables are returning errors and we cannot access critical business data.", ["os", "error"], "critical"),
                ("Production system completely down", "Our {app} production instance is completely down. Users cannot log in and all services are returning 500 errors. This is a full business outage.", ["error", "application"], "critical"),
                ("All company email stopped working", "No one in the company can send or receive email. Outlook and webmail are both showing errors. This started approximately {speed} hours ago.", ["office"], "critical"),

                # False-urgency prevention — equipment requests worded urgently
                ("Need new mouse ASAP", "Can I get a new mouse as soon as possible? Mine is a bit old and I'd like an upgrade.", ["peripheral"], "low"),
                ("Urgent: need replacement keyboard", "Urgent request: my keyboard is a bit worn but functional. When can I get a replacement?", ["peripheral"], "low"),
                ("ASAP monitor upgrade request", "I need a new monitor ASAP to improve my ergonomics. Not blocking work, just a request for an upgrade.", ["peripheral"], "low"),
                ("Important: laptop choice help", "Important question when you have time — I'm trying to choose between two laptop models for my next upgrade.", ["peripheral"], "low"),
            ],
            "os_list": ["Windows 11", "Windows 10", "macOS", "Windows"],
            "office_apps": ["Excel", "Word", "Outlook", "PowerPoint", "Teams", "Office"],
            "browsers": ["Chrome", "Firefox", "Edge", "Safari"],
            "apps": ["Adobe Acrobat", "Zoom", "Slack", "Visual Studio", "AutoCAD", "Photoshop", "QuickBooks"],
        },
        
        "network": {
            "weight": 0.18,  # 18% of tickets
            "subcategories": ["wireless", "connectivity", "lan", "vpn", "performance"],
            "templates": [
                # WiFi issues
                ("Can't connect to WiFi", "My {device} won't connect to the office WiFi. It sees the network but when I try to connect it says 'Can't connect to this network'.", ["wireless"], "high"),
                ("WiFi keeps disconnecting", "My WiFi connection drops every few minutes. I have to turn WiFi off and on to reconnect temporarily.", ["wireless"], "medium"),
                ("WiFi network not appearing", "I can't see the office WiFi network in my available networks list. Other people around me can see it.", ["wireless"], "high"),
                ("Slow WiFi speed", "My WiFi speed is extremely slow. Speedtest shows {speed} Mbps download when it should be much faster.", ["wireless"], "medium"),
                
                # Internet connectivity
                ("No internet connection", "I'm connected to the network but have no internet access. {browser} says 'No internet' for all websites.", ["connectivity"], "critical"),
                ("Internet works intermittently", "My internet connection works for a few minutes then stops. Have to unplug and replug ethernet cable to fix temporarily.", ["connectivity"], "high"),
                ("Can't access specific website", "I can't access {website} from my computer. It worked yesterday but now I get a timeout error.", ["connectivity"], "medium"),
                ("Network drive not accessible", "I can't access the shared network drive \\\\server\\{share}. It says the path doesn't exist.", ["lan"], "high"),
                ("Request access to shared folder", "I need access to the {share} shared folder on the network. I am a new employee and require access for my work.", ["lan"], "low"),
                ("Request access to public share", "I need access to the public share folder. I am an intern and I am in training.", ["lan"], "low"),
                ("Cannot access network share", "I'm unable to access the \\\\{share} network share. I get 'Access is denied' when I try to open it.", ["lan"], "medium"),
                ("Need access to team shared drive", "I've just joined the {share} team and need access to the shared network drive to do my job.", ["lan"], "low"),
                ("New hire needs network share access", "I started this week and need to be granted access to the shared folders on the network as part of onboarding.", ["lan"], "low"),
                ("Shared folder permission request", "Can you please grant me read access to the {share} shared folder? My manager has approved this request.", ["lan"], "low"),
                
                # VPN issues  
                ("VPN won't connect", "I'm trying to connect to the company VPN from home but it keeps timing out. I can access the internet fine without VPN.", ["vpn"], "high"),
                ("VPN connection drops frequently", "My VPN connection drops every 15-20 minutes. I have to reconnect which interrupts my work.", ["vpn"], "medium"),
                ("Slow speed when connected to VPN", "When I connect to VPN, my internet becomes extremely slow. Takes minutes to open a simple webpage.", ["vpn"], "medium"),
                
                # Critical — complete operational stoppage
                ("Server completely down, no access for team", "Our file server has been completely unreachable since this morning. No one in the office can access any shared files or network resources. We have {count} people unable to work.", ["connectivity", "performance"], "critical"),
                ("Entire office network outage", "We have a complete network outage affecting our entire {city} office. No one can access the internet, internal systems, or VPN. It has been down for over {speed} hours.", ["connectivity", "wireless"], "critical"),
                ("Network switch failure — all ports down", "The main network switch has failed and all connected devices have lost connectivity. This is affecting the entire floor / building.", ["connectivity", "lan"], "critical"),
                ("DNS failure — no websites resolve", "Nothing works — the DNS server appears to be down. No websites or internal services resolve for anyone on the network.", ["connectivity", "performance"], "critical"),
                ("Video calls have poor quality", "My video calls have terrible quality with constant freezing and audio delay. My internet speed seems fine.", ["performance"], "medium"),
            ],
            "devices": ["laptop", "computer", "desktop", "workstation"],
            "browsers": ["Chrome", "Firefox", "Edge"],
            "websites": ["company portal", "project management tool", "client website", "cloud storage"],
            "shares": ["projects", "shared", "team", "documents"],
        },
        
        "login": {
            "weight": 0.15,  # 15% of tickets
            "subcategories": ["password", "account_locked", "mfa", "sso", "access"],
            "templates": [
                # Password issues
                ("Forgot my password", "I forgot my password and can't log in. I've tried the reset option but haven't received the email.", ["password"], "high"),
                ("Password not working", "My password stopped working. I'm sure I'm typing it correctly but it says invalid credentials.", ["password"], "high"),
                ("Password expired", "I got a message that my password has expired. I need to reset it but the link isn't working.", ["password"], "high"),
                ("Can't change my password", "I'm trying to update my password as required but the system says my new password doesn't meet requirements.", ["password"], "medium"),
                
                # Account locked
                ("Account locked out", "My account is locked after too many login attempts. I was trying different passwords I thought might be correct.", ["account_locked"], "high"),
                ("Account disabled", "I can't log in and the message says my account has been disabled. I don't know why this happened.", ["account_locked"], "critical"),
                # Critical — all users locked out or authentication system down
                ("All users locked out of domain", "Our entire team cannot log into any company systems. It appears the Active Directory / LDAP authentication service is down. No one can access email, files, or applications.", ["account_locked", "sso"], "critical"),
                ("Authentication server down — company-wide login failure", "The authentication service is unreachable. All new login attempts are failing with a 'server unavailable' error across all applications.", ["sso", "account_locked"], "critical"),
                ("Executive account breached — urgent security incident", "We believe the CEO or Finance Director account has been compromised. We are seeing login activity from a foreign IP address and need immediate account lockdown.", ["account_locked"], "critical"),

                
                # MFA issues
                ("MFA code not working", "The code from my authenticator app isn't being accepted. I've tried multiple times with fresh codes.", ["mfa"], "high"),
                ("Lost access to MFA device", "I lost my phone with the authenticator app. I can't log in without the MFA code.", ["mfa"], "critical"),
                ("Not receiving MFA text messages", "I selected SMS for MFA but I'm not receiving the text messages with the code.", ["mfa"], "high"),
                
                # SSO issues
                ("SSO login not working", "When I try to log in with my company credentials, I get an error: 'Authentication failed'.", ["sso"], "high"),
                ("Being redirected to wrong login", "When I try to access {app}, it redirects me to the wrong login page.", ["sso"], "medium"),
                
                # Access issues
                ("Need access to {app}", "I've been told I need access to {app} for my new role. Please grant me the necessary permissions.", ["access"], "low"),
                ("Access removed incorrectly", "My access to {app} was removed but I still need it for my work. This might have been done in error.", ["access"], "high"),
                ("New employee needs account", "A new team member {name} started today and needs their accounts set up. Email: {email}", ["access"], "high"),
            ],
            "apps": ["email", "SharePoint", "project management system", "HR portal", "finance system", "CRM"],
            "names": ["John Smith", "Sarah Johnson", "Michael Chen", "Emily Davis", "Robert Wilson"],
        },
        
        "billing": {
            "weight": 0.08,  # 8% of tickets
            "subcategories": ["invoice", "payment", "subscription", "dispute", "account_suspended", "refund", "pricing"],
            "templates": [
                ("Invoice not received", "I haven't received my invoice for {month}. Can you please resend it to my email?", ["invoice"], "low"),
                ("Incorrect charge on invoice", "My invoice shows a charge of ${amount} that I don't recognize. Please explain this charge.", ["invoice"], "medium"),
                ("Need to update payment method", "I need to update my credit card on file as it's expiring soon. How do I do this?", ["payment"], "low"),
                ("Payment failed", "I received a notice that my payment failed. My card is valid so I'm not sure why.", ["payment"], "high"),
                ("Want to cancel subscription", "I'd like to cancel my subscription to {service} at the end of this billing period.", ["subscription"], "low"),
                ("Need to upgrade subscription", "I need to upgrade my subscription from Basic to Premium. Please advise on the process and pricing.", ["subscription"], "medium"),
                ("Charged twice this month", "I was charged twice for my {service} subscription this month. Please refund the duplicate charge.", ["dispute"], "high"),
                ("Refund not received", "I was promised a refund of ${amount} two weeks ago but I still haven't received it.", ["dispute"], "medium"),
                # --- Additional billing templates for class augmentation ---
                ("Subscription auto-renewed without notice", "My {service} subscription auto-renewed for ${amount} without any advance notification. I was not expecting this charge.", ["subscription", "dispute"], "medium"),
                ("Need VAT or tax invoice", "I need a VAT / tax-compliant invoice for my {service} subscription for {month}. The standard invoice you sent doesn't include the required tax details.", ["invoice"], "low"),
                ("Price increase not communicated", "I noticed my {service} subscription jumped from ${amount} to a higher rate this billing cycle. I never received any notice of a price increase.", ["pricing", "dispute"], "medium"),
                ("Failed bank transfer / ACH payment", "My ACH bank transfer for this month's invoice failed. I've confirmed the bank account details are correct. Please advise on how to retry.", ["payment"], "high"),
                ("Account suspended due to unpaid bill", "Our account has been suspended because of an unpaid invoice. We have already sent the payment — please confirm receipt and restore access immediately.", ["account_suspended", "payment"], "critical"),
                ("Need itemized invoice breakdown", "My invoice for {month} shows a total of ${amount} but doesn't break down the charges by service or user seat. I need an itemized version for our finance team.", ["invoice"], "low"),
                ("Refund for unused license seats", "We downgraded our plan mid-cycle and are owed a prorated refund for the unused {service} license seats. When can I expect this refund?", ["refund", "subscription"], "medium"),
                ("Outage credit / SLA dispute", "Last month's service outage lasted over 4 hours, which exceeds our SLA. I'd like to request the service credit we're entitled to under the agreement.", ["dispute"], "medium"),
                ("Need to update billing address", "Our company has moved offices. Please update the billing address on our account to the new location.", ["invoice"], "low"),
                ("Request payment receipt for expense", "Could you send me a payment receipt for Invoice #{amount} dated {month}? I need it for an expense reimbursement claim.", ["invoice", "payment"], "low"),
                ("Downgrade subscription plan", "I'd like to downgrade my {service} plan at the end of this billing period to reduce costs. Please confirm the process and the effective date.", ["subscription"], "low"),
                ("Billing threshold alert firing unexpectedly", "I'm getting billing threshold alerts even though our usage hasn't changed. The alerts say we've hit ${amount} but my usage dashboard shows much less.", ["pricing"], "medium"),
                ("Need to transfer billing contact", "{name} who was our billing contact has left the company. Please update the billing contact to myself and transfer the payment information securely.", ["payment", "invoice"], "medium"),
                ("Early termination fee dispute", "We cancelled our {service} contract but were charged an early termination fee of ${amount}. According to our contract, no such fee applies after 12 months.", ["dispute"], "high"),
                ("Credit card declined but card is valid", "Our corporate credit card is being declined for the {service} renewal even though the card is current and has available credit. Please help resolve this.", ["payment"], "high"),
                ("Need multi-year licensing quote", "We are planning our {month} budget and would like a quote for a 3-year {service} license to take advantage of volume or multi-year pricing.", ["pricing", "subscription"], "low"),
                ("Duplicate accounts being billed", "It looks like our company has two separate billing accounts for {service} and we are being charged twice. Please merge these accounts and issue a refund.", ["dispute", "subscription"], "high"),
            ],
            "services": ["cloud storage", "premium support", "software license", "hosting", "SaaS platform", "analytics suite", "backup service"],
            "months": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        },
        
        "account": {
            "weight": 0.08,  # 8% of tickets 
            "subcategories": ["profile", "settings", "permissions", "deletion", "onboarding", "ownership", "audit"],
            "templates": [
                ("Need to update my email address", "I recently got married and need to change my email address from {old_email} to {new_email}.", ["profile"], "low"),
                ("Update my contact information", "Please update my phone number to {phone} in the system.", ["profile"], "low"),
                ("Can't change my profile settings", "When I try to update my profile information, the save button doesn't work.", ["settings"], "medium"),
                ("Notification settings not saving", "I've disabled email notifications several times but I keep receiving them.", ["settings"], "low"),
                ("Need additional permissions", "I need edit permissions for the {system} to do my job. Currently I only have view access.", ["permissions"], "medium"),
                ("Remove user from system", "{name} has left the company and their account should be deactivated.", ["deletion"], "high"),
                ("Request account deletion", "Please delete my account and all associated data as per GDPR requirements.", ["deletion"], "medium"),
                # --- Additional account templates for class augmentation ---
                ("Reset two-factor authentication method", "I got a new phone and no longer have access to my authentication app. I need someone to reset my two-factor authentication so I can set it up on the new device.", ["settings", "profile"], "high"),
                ("Change username or login ID", "I'd like to change my username in the {system}. My current one is outdated and doesn't follow the new naming convention.", ["profile"], "low"),
                ("Request role change to administrator", "I have taken on new responsibilities and need administrator access in {system}. My manager has approved this request.", ["permissions"], "medium"),
                ("Account creation for new contractor", "We have a new contractor starting Monday. Please create an account in {system} with limited access appropriate for external contractors.", ["onboarding"], "medium"),
                ("Re-enable account for returning employee", "{name} was a former employee and has rejoined the company. Their account was deactivated — please re-enable it with their previous role settings.", ["onboarding", "deletion"], "medium"),
                ("Transfer account ownership after departure", "{name} is leaving this week and owns several shared resources in {system}. Please transfer ownership to me before their account is deactivated.", ["ownership", "deletion"], "high"),
                ("Emergency data export for departing employee", "{name}'s termination is effective today and we need an immediate export of their data from {system} before their account is closed.", ["deletion", "ownership"], "critical"),
                ("Request account activity audit log", "We need an audit log of all actions performed by {name} in {system} over the past 90 days for a compliance review.", ["audit"], "medium"),
                ("Unlock frozen account", "My account appears to be frozen — I can log in but can't perform any actions and get a 'read-only mode' error everywhere.", ["settings"], "high"),
                ("Update emergency contact in system", "I need to update my emergency contact information in the HR system. The current information is outdated.", ["profile"], "low"),
                ("Link multiple accounts after company merger", "After our recent acquisition, I have two separate accounts in {system}. Please merge them into a single account with all my history preserved.", ["profile"], "medium"),
                ("Grant temporary admin access for project", "I need temporary administrator access in {system} for a two-week project. Please set up the elevated permissions with an auto-expiry date.", ["permissions"], "medium"),
                ("Account auto-locked due to inactivity", "My account in {system} was automatically locked because I was on leave for 6 weeks. Please unlock it and adjust the inactivity lockout policy for approved leave scenarios.", ["settings"], "medium"),
                ("Restrict account to specific IP range", "For security purposes, I'd like to restrict my account login to our office IP range only. How can I configure this?", ["settings"], "low"),
                ("Bulk deactivate accounts for project team", "Our project has concluded and the following 8 contractor accounts in {system} need to be deactivated: please process all accounts for the '{system}' project team.", ["deletion"], "medium"),
                ("Account incorrectly showing as inactive", "My account in {system} is showing as 'inactive' even though I use it daily. This is causing reporting errors. Please correct the status.", ["settings"], "low"),
                ("Set up shared team account", "Our team needs a shared service account in {system} to run scheduled tasks. Please create the account with the appropriate service-account permissions.", ["onboarding", "permissions"], "low"),
                ("Account not appearing in directory", "My account does not appear in the company directory in {system}. Other employees cannot find me when they try to assign tasks or send messages.", ["profile"], "low"),
                ("Need to change account language and locale", "I've relocated internationally and need to change the language and regional settings on my account in {system}, including date format and currency.", ["settings"], "low"),
            ],
            "systems": ["project management", "file sharing", "CRM", "HR system", "service desk", "identity management portal", "ERP"],
            "names": ["John Smith", "Sarah Johnson", "Michael Chen", "Emily Davis", "Robert Wilson", "Jessica Lee"],
        },
        
        "feature_request": {
            "weight": 0.06,  # 6% of tickets
            "subcategories": ["enhancement", "new_feature", "integration", "accessibility", "reporting", "api"],
            "templates": [
                ("Request for new feature", "It would be great if the {system} could {feature}. This would save our team a lot of time.", ["new_feature"], "low"),
                ("Improvement suggestion", "The current {system} workflow is cumbersome. Could you add the ability to {feature}?", ["enhancement"], "low"),
                ("Integration request", "We need {system} to integrate with {other_system}. Is this possible?", ["integration"], "low"),
                ("Mobile app feature request", "Could you add {feature} to the mobile app? It's available on desktop but not mobile.", ["enhancement"], "low"),
                ("Bulk action needed", "Please add the ability to {action} multiple items at once in the {system}.", ["enhancement"], "low"),
                ("Dashboard customization", "I'd like to be able to customize my dashboard to show {feature}.", ["new_feature"], "low"),
                # False-urgency prevention — feature requests worded urgently
                ("Urgent feature request", "Urgently requesting that the {system} gets the ability to {feature}. Would be great to have.", ["new_feature"], "low"),
                ("ASAP: need better reports", "I need better reporting ASAP. The current dashboard is missing {feature}. Not blocking, just a strong request.", ["enhancement"], "low"),
                # --- Additional feature_request templates for class augmentation ---
                ("API access for third-party integration", "Our development team needs API access to {system} so we can build a custom integration with our internal tools. Can you provide API documentation and credentials?", ["api", "integration"], "low"),
                ("Export reports to PDF format", "The current {system} only allows CSV exports. Could you please add PDF export so we can share formatted reports with stakeholders who don't have system access?", ["reporting", "new_feature"], "low"),
                ("Accessibility improvements for screen readers", "Our team has a colleague who uses a screen reader and has difficulty navigating {system}. Could you improve ARIA labeling and keyboard navigation to support accessibility standards?", ["accessibility", "enhancement"], "low"),
                ("Custom report builder", "We would like a drag-and-drop custom report builder in {system} so we can create reports without needing to ask IT. The current fixed reports don't cover our use cases.", ["reporting", "new_feature"], "low"),
                ("Dark mode for the interface", "Could you add a dark mode option to {system}? Working long hours with the current bright interface causes eye strain for many of our team members.", ["enhancement"], "low"),
                ("Multi-language support", "Our company operates in multiple countries. Could you add support for additional languages in {system}, specifically Spanish, French, and German?", ["new_feature"], "low"),
                ("Mobile push notifications", "I'd like to receive push notifications on my phone when a new {action} happens in {system}. Currently, the only option is email which I check less frequently.", ["new_feature", "enhancement"], "low"),
                ("Webhook / event notification support", "Could you add webhook support to {system}? We want to trigger automated workflows in {other_system} when certain events occur, such as status changes.", ["api", "integration"], "low"),
                ("AI-powered ticket suggestions in search", "It would be very helpful if {system} could use AI to suggest related articles or past tickets when I search, rather than just keyword matching.", ["new_feature"], "low"),
                ("Two-factor authentication option", "Please add two-factor authentication as an option in {system}. Our security team has flagged the lack of MFA as a risk during our compliance review.", ["new_feature"], "low"),
                ("Audit trail / activity history", "We need a full audit trail in {system} showing who changed what and when. This is required for our SOC 2 compliance audit next month.", ["new_feature"], "medium"),
                ("Offline mode for mobile app", "Could you add an offline mode to the {system} mobile app? Our field technicians often work in areas with poor connectivity and need to enter data without internet access.", ["new_feature", "enhancement"], "low"),
                ("Recurring task or ticket creation", "Please add the ability to set up recurring tickets or tasks in {system}. We have regular maintenance activities that need to be logged weekly.", ["enhancement"], "low"),
                ("Saved search filters", "I'd like to be able to save my frequently used search filters in {system} so I don't have to re-enter them every time I open the tool.", ["enhancement"], "low"),
                ("Calendar sync with {other_system}", "Could you add calendar synchronization between {system} and {other_system}? We want our scheduled tasks to appear in our team's calendar automatically.", ["integration"], "low"),
                ("Batch import from CSV", "Please add the ability to import records into {system} from a CSV file. Currently we have to enter items one by one which is very time-consuming for large data sets.", ["enhancement", "new_feature"], "low"),
                ("Granular role permissions", "The current {system} only has admin/user roles. We need more granular permissions so we can give certain users read-only access to specific modules without full admin rights.", ["new_feature"], "low"),
                ("SLA tracking and alerting", "Could you add built-in SLA tracking to {system}? We need the system to automatically flag tickets that are approaching or have breached their SLA targets.", ["new_feature"], "medium"),
                ("Copy ticket or duplicate template", "It would be helpful to be able to duplicate an existing ticket in {system} as a starting point for a new one. We frequently raise similar tickets with minor variations.", ["enhancement"], "low"),
                ("White-label or custom branding", "Is it possible to customize the branding of the {system} interface with our company logo and color scheme for our client-facing portal?", ["enhancement"], "low"),
                ("Improved search with boolean operators", "The search in {system} is very basic. Please add Boolean operators (AND, OR, NOT) and field-specific search so we can find tickets more precisely.", ["enhancement"], "low"),
            ],
            "systems": ["project management tool", "reporting system", "dashboard", "mobile app", "portal", "ticketing system", "knowledge base"],
            "features": ["export to Excel", "batch delete", "custom notifications", "dark mode", "keyboard shortcuts", "auto-save", "smart search", "real-time status updates"],
            "other_systems": ["Slack", "Teams", "Salesforce", "JIRA", "Google Drive", "ServiceNow", "Zapier"],
            "actions": ["delete", "archive", "assign", "tag", "export", "approve", "escalate"],
        },
        
        "other": {
            "weight": 0.10,  # 10% of tickets
            "subcategories": ["general", "inquiry", "feedback"],
            "templates": [
                ("General inquiry", "I have a question about {topic}. Can someone please help me understand this better?", ["inquiry"], "low"),
                ("How do I {task}?", "I'm not sure how to {task} in the system. Could you provide instructions?", ["inquiry"], "low"),
                ("Feedback on service", "I wanted to provide feedback on my recent support experience. {feedback}", ["feedback"], "low"),
                ("Training request", "I need training on how to use {system}. Is there documentation or videos available?", ["inquiry"], "low"),
                ("Conference room booking issue", "I'm having trouble booking conference room {room} for my meeting tomorrow.", ["general"], "medium"),
                ("Equipment request", "I need to request a {equipment} for my work. What's the process?", ["inquiry"], "low"),
                ("Office supplies needed", "My team needs {supplies}. How do I order them?", ["inquiry"], "low"),
                # False-urgency prevention — informational / scheduling
                ("Urgent: when is IT training?", "Urgent request: when is the next IT training session? I want to sign up before it fills up.", ["inquiry"], "low"),
                ("ASAP: IT training schedule", "Can someone tell me ASAP when the next IT orientation is? I'm a new hire and want to attend.", ["inquiry"], "low"),
                ("Important: training materials request", "This is important to me personally — can I get a link to the onboarding IT training materials?", ["inquiry"], "low"),
            ],
            "topics": ["pricing plans", "service levels", "maintenance windows", "company policies"],
            "tasks": ["export data", "change settings", "add team members", "generate reports"],
            "systems": ["the new CRM", "project management tool", "HR portal", "expense system"],
            "feedback": ["The response was quick and helpful.", "The issue was resolved but took longer than expected.", "Very satisfied with the support received."],
            "rooms": ["A101", "B205", "C300", "Main Conference"],
            "equipment": ["second monitor", "docking station", "webcam", "headset"],
            "supplies": ["printer paper", "notebooks", "pens", "tape"],
        },
    }
    
    PRIORITIES = ["low", "medium", "high", "critical"]
    # More balanced distribution reduces class imbalance for the ML priority model.
    # Raised HIGH from 0.20 → 0.27 and CRITICAL from 0.05 → 0.08 to give the
    # model sufficient training signal for urgent tickets.
    # Reduced LOW from 0.40 → 0.30 to lower the baseline bias toward low.
    PRIORITY_WEIGHTS = {"low": 0.30, "medium": 0.35, "high": 0.27, "critical": 0.08}  # Target distribution
    
    # User companies for metadata
    COMPANIES = [
        "Tech Innovations Inc.", "Global Retail Solutions", "Healthcare Partners",
        "Financial Services Group", "Education Foundation", "Manufacturing Corp",
        "Media & Entertainment LLC", "Consulting Associates", "Legal Services LLP",
        "Construction Holdings", "Logistics International", "Research Institute"
    ]
    
    def __init__(self, seed: int = None):
        """
        Initialize the synthetic data generator.
        
        Args:
            seed: Random seed for reproducibility
        """
        if seed is not None:
            random.seed(seed)
        self.ticket_counter = 0
        self.base_date = datetime(2025, 1, 1)  # Start generating from this date
        
        # Additional variation lists for unique content
        self._time_refs = [
            "started {when}",
            "first noticed {when}", 
            "began happening {when}",
            "has been occurring since {when}",
            "appeared {when}",
        ]
        self._when_phrases = [
            "this morning", "yesterday", "yesterday afternoon", "last night",
            "earlier today", "a few hours ago", "this week", "last week",
            "since Monday", "since yesterday", "about an hour ago", "just now",
            "after lunch", "before our meeting", "during a presentation",
        ]
        self._locations = [
            "at my desk in Building {bldg}",
            "in the {floor} floor office",
            "from my home office",
            "while working remotely",
            "at our {city} location",
            "in meeting room {room_num}",
            "in the IT department",
            "in the {dept} department",
        ]
        self._extra_context = [
            " I have a deadline {deadline}.",
            " This is affecting my productivity.",
            " Multiple colleagues have the same issue.",
            " I've already restarted {count} times.",
            " My ticket reference is {ref_id}.",
            " Asset tag: {asset_tag}.",
            " This worked fine before.",
            " I tried the troubleshooting guide but it didn't help.",
            " Please prioritize this.",
            " I'm working on an important project.",
        ]
        self._cities = ["Downtown", "Houston", "Austin", "Dallas", "Chicago"]
        self._departments = ["Sales", "Marketing", "Engineering", "Finance", "HR", "Operations"]
        
    def _add_unique_context(self, description: str) -> str:
        """Add unique contextual information to make descriptions more distinct."""
        additions = []
        
        # 70% chance to add timing context
        if random.random() < 0.7:
            time_ref = random.choice(self._time_refs).replace("{when}", random.choice(self._when_phrases))
            additions.append(f" This {time_ref}.")
        
        # 40% chance to add location context
        if random.random() < 0.4:
            location = random.choice(self._locations)
            location = location.replace("{bldg}", str(random.choice(["A", "B", "C", "1", "2", "3"])))
            location = location.replace("{floor}", random.choice(["2nd", "3rd", "4th", "5th", "ground"]))
            location = location.replace("{city}", random.choice(self._cities))
            location = location.replace("{room_num}", str(random.randint(101, 999)))
            location = location.replace("{dept}", random.choice(self._departments))
            additions.append(f" I'm working {location}.")
        
        # 30% chance to add extra context
        if random.random() < 0.3:
            extra = random.choice(self._extra_context)
            extra = extra.replace("{deadline}", random.choice(["tomorrow", "today", "end of week", "in 2 days"]))
            extra = extra.replace("{count}", str(random.randint(2, 5)))
            extra = extra.replace("{ref_id}", f"REF-{random.randint(10000, 99999)}")
            extra = extra.replace("{asset_tag}", f"IT-{random.randint(1000, 9999)}-{random.choice(['A', 'B', 'C', 'D'])}")
            additions.append(extra)
        
        # 20% chance to add unique identifier
        if random.random() < 0.2:
            additions.append(f" Employee ID: {random.randint(10000, 99999)}.")
        
        return description + "".join(additions)
        
    def _fill_template(self, template: str, category: str) -> str:
        """Fill a template with random values appropriate to the category."""
        cat_data = self.CATEGORIES[category]
        
        # Common replacements
        replacements = {
            "{device}": random.choice(cat_data.get("devices", ["computer", "laptop"])),
            "{os}": random.choice(cat_data.get("os_list", ["Windows", "macOS"])),
            "{browser}": random.choice(cat_data.get("browsers", ["Chrome", "Firefox", "Edge"])),
            "{app}": random.choice(cat_data.get("apps", ["the application", "the software"])),
            "{office_app}": random.choice(cat_data.get("office_apps", ["Excel", "Word", "Outlook"])),
            "{keyboard}": random.choice(cat_data.get("keyboards", ["keyboard"])),
            "{display}": random.choice(cat_data.get("displays", ["monitor", "screen"])),
            "{website}": random.choice(cat_data.get("websites", ["the website", "the portal"])),
            "{share}": random.choice(cat_data.get("shares", ["shared", "projects"])),
            "{service}": random.choice(cat_data.get("services", ["service", "subscription"])),
            "{month}": random.choice(cat_data.get("months", ["this month"])),
            "{system}": random.choice(cat_data.get("systems", ["the system", "the application"])),
            "{name}": random.choice(cat_data.get("names", ["an employee"])),
            "{feature}": random.choice(cat_data.get("features", ["a new feature"])),
            "{other_system}": random.choice(cat_data.get("other_systems", ["another system"])),
            "{action}": random.choice(cat_data.get("actions", ["update"])),
            "{topic}": random.choice(cat_data.get("topics", ["a topic"])),
            "{task}": random.choice(cat_data.get("tasks", ["complete this task"])),
            "{feedback}": random.choice(cat_data.get("feedback", ["Good service."])),
            "{room}": random.choice(cat_data.get("rooms", ["meeting room"])),
            "{equipment}": random.choice(cat_data.get("equipment", ["equipment"])),
            "{supplies}": random.choice(cat_data.get("supplies", ["supplies"])),
            "{error_code}": f"0x{random.randint(1000, 9999):04X}",
            "{random_error}": random.choice(["An error occurred", "Operation failed", "Unknown error", "Access denied"]),
            "{amount}": f"{random.randint(10, 500)}.{random.randint(0, 99):02d}",
            "{percent}": str(random.randint(10, 90)),
            "{speed}": str(random.randint(1, 10)),
            "{old_email}": f"{random.choice(['john', 'jane', 'mike'])}@oldcompany.com",
            "{new_email}": f"{random.choice(['john', 'jane', 'mike'])}@newcompany.com",
            "{email}": f"newuser{random.randint(1, 100)}@company.com",
            "{phone}": f"+1-555-{random.randint(100, 999)}-{random.randint(1000, 9999)}",
        }
        
        result = template
        for placeholder, value in replacements.items():
            result = result.replace(placeholder, value)
        
        return result
    
    def _generate_created_date(self) -> datetime:
        """Generate a realistic created date."""
        # Generate dates over the past year with more recent dates more likely
        days_ago = int(random.expovariate(1/60))  # Exponential distribution, avg 60 days ago
        days_ago = min(days_ago, 365)  # Cap at 1 year
        
        hours = random.randint(8, 18)  # More likely during business hours
        if random.random() < 0.2:  # 20% chance of off-hours
            hours = random.randint(0, 23)
        
        return datetime.now() - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))
    
    def _calculate_resolution_time(self, priority: str, category: str) -> Optional[float]:
        """Calculate realistic resolution time in hours based on priority."""
        # Base resolution times by priority (in hours)
        base_times = {
            "critical": (2, 24),    # 2-24 hours
            "high": (4, 48),        # 4-48 hours  
            "medium": (8, 120),     # 8-120 hours (up to 5 days)
            "low": (24, 240)        # 24-240 hours (1-10 days)
        }
        
        min_time, max_time = base_times.get(priority, (24, 120))
        return round(random.uniform(min_time, max_time), 2)
    
    def generate_ticket(self, category: str = None, priority: str = None) -> Dict:
        """
        Generate a single synthetic ticket.
        
        Args:
            category: Optional category override
            priority: Optional priority override
            
        Returns:
            Dictionary containing ticket data
        """
        self.ticket_counter += 1
        
        # Select category based on weights if not provided
        if category is None:
            categories = list(self.CATEGORIES.keys())
            weights = [self.CATEGORIES[c]["weight"] for c in categories]
            category = random.choices(categories, weights=weights)[0]
        
        cat_data = self.CATEGORIES[category]
        
        # Select a template
        subject_template, desc_template, subcats, template_priority = random.choice(cat_data["templates"])
        
        # Fill templates and add unique context to reduce duplicates
        subject = self._fill_template(subject_template, category)
        description = self._fill_template(desc_template, category)
        description = self._add_unique_context(description)  # Add unique variations
        
        # Determine priority (use template suggestion with some variation)
        if priority is None:
            if random.random() < 0.7:  # 70% chance to use template priority
                priority = template_priority
            else:
                priority = random.choices(
                    self.PRIORITIES,
                    weights=[self.PRIORITY_WEIGHTS[p] for p in self.PRIORITIES]
                )[0]
        
        # Generate timestamps
        created_at = self._generate_created_date()
        
        # Determine status (weighted towards resolved for older tickets)
        days_old = (datetime.now() - created_at).days
        if days_old > 7:
            status = random.choices(
                ["open", "in_progress", "waiting_on_customer", "resolved", "closed"],
                weights=[0.05, 0.05, 0.05, 0.40, 0.45]
            )[0]
        elif days_old > 2:
            status = random.choices(
                ["open", "in_progress", "waiting_on_customer", "resolved", "closed"],
                weights=[0.10, 0.20, 0.15, 0.30, 0.25]
            )[0]
        else:
            status = random.choices(
                ["open", "in_progress", "waiting_on_customer", "resolved", "closed"],
                weights=[0.40, 0.35, 0.15, 0.05, 0.05]
            )[0]
        
        # Calculate resolution time
        resolved_at = None
        time_to_resolution_hours = None
        if status in ["resolved", "closed"]:
            time_to_resolution_hours = self._calculate_resolution_time(priority, category)
            resolved_at = created_at + timedelta(hours=time_to_resolution_hours)
        
        # Generate AI classification metadata
        ai_confidence = round(random.uniform(0.65, 0.99), 2)
        ai_classified = random.random() < 0.85  # 85% of tickets AI classified
        
        # Sometimes AI and final category/priority differ
        ai_category = category
        ai_priority = priority
        if random.random() < 0.1:  # 10% chance AI was wrong
            ai_category = random.choice(list(self.CATEGORIES.keys()))
            ai_confidence = round(random.uniform(0.50, 0.75), 2)  # Lower confidence when wrong
        
        if random.random() < 0.15:  # 15% chance priority was adjusted
            ai_priority = random.choice(self.PRIORITIES)
        
        # User metadata
        user_previous_tickets = int(random.expovariate(1/5))  # Exponential, avg 5 tickets
        company = random.choice(self.COMPANIES)
        
        # Generate ticket number
        year = created_at.year
        ticket_number = f"TICK-{year}-{self.ticket_counter:05d}"
        
        return {
            "id": self.ticket_counter,
            "ticket_number": ticket_number,
            "subject": subject,
            "description": description,
            "category": category,
            "priority": priority,
            "user_priority": priority if random.random() < 0.3 else None,  # 30% have user priority
            "ai_priority": ai_priority,
            "status": status,
            "ai_classified": ai_classified,
            "ai_confidence": ai_confidence if ai_classified else None,
            "ai_recommended_priority": ai_priority,
            "priority_overridden": ai_priority != priority,
            "resolution": f"Issue resolved by {'technician' if random.random() < 0.7 else 'user'}" if status in ["resolved", "closed"] else None,
            "resolved_at": resolved_at.isoformat() if resolved_at else None,
            "created_at": created_at.isoformat(),
            "updated_at": (created_at + timedelta(hours=random.randint(0, 48))).isoformat(),
            "time_to_resolution_hours": time_to_resolution_hours,
            "customer_company": company,
            "user_previous_tickets": user_previous_tickets,
            "comment_count": random.randint(0, 15),
            "reopen_count": random.choices([0, 1, 2, 3], weights=[0.85, 0.10, 0.04, 0.01])[0],
            "subcategory": random.choice(subcats),
        }
    
    def generate(self, 
                 n_samples: int = 1000,
                 balance_categories: bool = True,
                 balance_priorities: bool = True) -> List[Dict]:
        """
        Generate multiple synthetic tickets.
        
        Args:
            n_samples: Number of tickets to generate
            balance_categories: Whether to balance category distribution
            balance_priorities: Whether to balance priority distribution
            
        Returns:
            List of ticket dictionaries
        """
        tickets = []
        
        if balance_categories:
            # Generate tickets to match target distribution
            for category, cat_data in self.CATEGORIES.items():
                n_for_category = int(n_samples * cat_data["weight"])
                for _ in range(n_for_category):
                    tickets.append(self.generate_ticket(category=category))
            
            # Fill remaining with random categories
            while len(tickets) < n_samples:
                tickets.append(self.generate_ticket())
        else:
            for _ in range(n_samples):
                tickets.append(self.generate_ticket())
        
        # Shuffle to mix categories
        random.shuffle(tickets)
        
        # Re-index
        for i, ticket in enumerate(tickets):
            ticket["id"] = i + 1
        
        print(f"✓ Generated {len(tickets)} synthetic tickets")
        return tickets
    
    def get_category_distribution(self, tickets: List[Dict]) -> Dict[str, int]:
        """Get the distribution of categories in generated tickets."""
        distribution = {}
        for ticket in tickets:
            cat = ticket["category"]
            distribution[cat] = distribution.get(cat, 0) + 1
        return distribution
    
    def get_priority_distribution(self, tickets: List[Dict]) -> Dict[str, int]:
        """Get the distribution of priorities in generated tickets."""
        distribution = {}
        for ticket in tickets:
            pri = ticket["priority"]
            distribution[pri] = distribution.get(pri, 0) + 1
        return distribution
    
    def save_to_csv(self, tickets: List[Dict], filepath: str):
        """Save tickets to CSV file."""
        if not tickets:
            print("✗ No tickets to save")
            return
        
        os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)
        
        fieldnames = tickets[0].keys()
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(tickets)
        
        print(f"✓ Saved {len(tickets)} tickets to {filepath}")
    
    def save_to_json(self, tickets: List[Dict], filepath: str):
        """Save tickets to JSON file."""
        if not tickets:
            print("✗ No tickets to save")
            return
        
        os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(tickets, f, indent=2, default=str)
        
        print(f"✓ Saved {len(tickets)} tickets to {filepath}")


if __name__ == "__main__":
    # Example usage
    generator = SyntheticDataGenerator(seed=42)
    
    # Generate 1000 balanced tickets
    tickets = generator.generate(n_samples=1000)
    
    # Show distributions
    print("\nCategory Distribution:")
    cat_dist = generator.get_category_distribution(tickets)
    for cat, count in sorted(cat_dist.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count} ({count/len(tickets)*100:.1f}%)")
    
    print("\nPriority Distribution:")
    pri_dist = generator.get_priority_distribution(tickets)
    for pri, count in sorted(pri_dist.items(), key=lambda x: -x[1]):
        print(f"  {pri}: {count} ({count/len(tickets)*100:.1f}%)")
    
    # Save
    generator.save_to_csv(tickets, '../data/raw/synthetic_tickets.csv')
    generator.save_to_json(tickets, '../data/raw/synthetic_tickets.json')
