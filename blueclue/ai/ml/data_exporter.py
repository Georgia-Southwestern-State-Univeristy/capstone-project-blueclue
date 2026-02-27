"""
Data Exporter Module
====================

Exports ticket data from PostgreSQL database for ML training.
Handles database connection, data extraction, and export to CSV/JSON.
"""

import os
import json
import csv
from datetime import datetime
from typing import Dict, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor


class DataExporter:
    """
    Exports historical ticket data from PostgreSQL database.
    
    This class connects to the BlueClue database and extracts tickets
    with all relevant fields for machine learning training.
    
    Usage:
        exporter = DataExporter()
        exporter.connect()
        tickets = exporter.export_tickets()
        exporter.save_to_csv(tickets, 'raw_tickets.csv')
        exporter.disconnect()
    """
    
    def __init__(self, 
                 host: str = None,
                 port: int = None,
                 database: str = None,
                 user: str = None,
                 password: str = None):
        """
        Initialize the data exporter with database connection parameters.
        
        Args:
            host: Database host (default: from env or 'localhost')
            port: Database port (default: from env or 5432)
            database: Database name (default: from env or 'blueclue')
            user: Database user (default: from env or 'postgres')
            password: Database password (default: from env)
        """
        self.host = host or os.getenv('DB_HOST', 'localhost')
        self.port = port or int(os.getenv('DB_PORT', '5432'))
        self.database = database or os.getenv('DB_NAME', 'blueclue')
        self.user = user or os.getenv('DB_USER', 'postgres')
        self.password = password or os.getenv('DB_PASSWORD', '')
        self.connection = None
        
    def connect(self) -> bool:
        """
        Establish connection to the database.
        
        Returns:
            bool: True if connection successful, False otherwise
        """
        try:
            self.connection = psycopg2.connect(
                host=self.host,
                port=self.port,
                database=self.database,
                user=self.user,
                password=self.password
            )
            print(f"✓ Connected to database: {self.database}@{self.host}")
            return True
        except Exception as e:
            print(f"✗ Database connection failed: {e}")
            return False
    
    def disconnect(self):
        """Close the database connection."""
        if self.connection:
            self.connection.close()
            self.connection = None
            print("✓ Database connection closed")
    
    def export_tickets(self, 
                       limit: Optional[int] = None,
                       include_resolved: bool = True,
                       min_description_length: int = 10) -> List[Dict]:
        """
        Export tickets from the database with all relevant ML fields.
        
        Args:
            limit: Maximum number of tickets to export (None for all)
            include_resolved: Whether to include resolved/closed tickets
            min_description_length: Minimum description length to include
            
        Returns:
            List of ticket dictionaries with relevant fields
        """
        if not self.connection:
            raise ConnectionError("Not connected to database. Call connect() first.")
        
        query = """
        SELECT 
            t.id,
            t.ticket_number,
            t.subject,
            t.description,
            t.category::text as category,
            t.priority::text as priority,
            t.user_priority::text as user_priority,
            t.ai_priority::text as ai_priority,
            t.status::text as status,
            t.ai_classified,
            t.ai_confidence,
            t.ai_recommended_priority::text as ai_recommended_priority,
            t.priority_overridden,
            t.priority_override_reason,
            t.priority_calculation_method,
            t.resolution,
            t.resolved_at,
            t.first_response_at,
            t.created_at,
            t.updated_at,
            t.closed_at,
            t.reopen_count,
            -- Calculate resolution time in hours
            EXTRACT(EPOCH FROM (COALESCE(t.resolved_at, NOW()) - t.created_at)) / 3600 as time_to_resolution_hours,
            -- User info (anonymized)
            u.role::text as customer_role,
            u.company as customer_company,
            -- Count previous tickets from this user
            (SELECT COUNT(*) FROM tickets t2 WHERE t2.customer_id = t.customer_id AND t2.created_at < t.created_at) as user_previous_tickets,
            -- Comment count
            (SELECT COUNT(*) FROM ticket_comments tc WHERE tc.ticket_id = t.id) as comment_count
        FROM tickets t
        LEFT JOIN users u ON t.customer_id = u.id
        WHERE LENGTH(t.description) >= %s
        """
        
        params = [min_description_length]
        
        if not include_resolved:
            query += " AND t.status NOT IN ('resolved', 'closed')"
        
        query += " ORDER BY t.created_at DESC"
        
        if limit:
            query += " LIMIT %s"
            params.append(limit)
        
        try:
            with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
                cursor.execute(query, params)
                tickets = cursor.fetchall()
                
            # Convert to list of dicts and handle datetime serialization
            result = []
            for ticket in tickets:
                ticket_dict = dict(ticket)
                # Convert datetime objects to ISO format strings
                for key, value in ticket_dict.items():
                    if isinstance(value, datetime):
                        ticket_dict[key] = value.isoformat()
                result.append(ticket_dict)
            
            print(f"✓ Exported {len(result)} tickets from database")
            return result
            
        except Exception as e:
            print(f"✗ Error exporting tickets: {e}")
            raise
    
    def get_ticket_statistics(self) -> Dict:
        """
        Get statistics about the ticket data in the database.
        
        Returns:
            Dictionary with counts and distributions
        """
        if not self.connection:
            raise ConnectionError("Not connected to database. Call connect() first.")
        
        stats = {}
        
        with self.connection.cursor(cursor_factory=RealDictCursor) as cursor:
            # Total count
            cursor.execute("SELECT COUNT(*) as total FROM tickets")
            stats['total_tickets'] = cursor.fetchone()['total']
            
            # Category distribution
            cursor.execute("""
                SELECT category::text, COUNT(*) as count 
                FROM tickets 
                GROUP BY category 
                ORDER BY count DESC
            """)
            stats['category_distribution'] = {r['category']: r['count'] for r in cursor.fetchall()}
            
            # Priority distribution
            cursor.execute("""
                SELECT priority::text, COUNT(*) as count 
                FROM tickets 
                GROUP BY priority 
                ORDER BY count DESC
            """)
            stats['priority_distribution'] = {r['priority']: r['count'] for r in cursor.fetchall()}
            
            # Status distribution
            cursor.execute("""
                SELECT status::text, COUNT(*) as count 
                FROM tickets 
                GROUP BY status 
                ORDER BY count DESC
            """)
            stats['status_distribution'] = {r['status']: r['count'] for r in cursor.fetchall()}
            
            # AI classified percentage
            cursor.execute("""
                SELECT 
                    SUM(CASE WHEN ai_classified THEN 1 ELSE 0 END)::float / COUNT(*) * 100 as ai_classified_pct
                FROM tickets
            """)
            stats['ai_classified_percentage'] = cursor.fetchone()['ai_classified_pct']
            
            # Average description length
            cursor.execute("SELECT AVG(LENGTH(description)) as avg_len FROM tickets")
            stats['avg_description_length'] = cursor.fetchone()['avg_len']
        
        print(f"✓ Retrieved statistics for {stats['total_tickets']} tickets")
        return stats
    
    def save_to_csv(self, tickets: List[Dict], filepath: str):
        """
        Save tickets to a CSV file.
        
        Args:
            tickets: List of ticket dictionaries
            filepath: Path to output CSV file
        """
        if not tickets:
            print("✗ No tickets to save")
            return
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)
        
        fieldnames = tickets[0].keys()
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(tickets)
        
        print(f"✓ Saved {len(tickets)} tickets to {filepath}")
    
    def save_to_json(self, tickets: List[Dict], filepath: str):
        """
        Save tickets to a JSON file.
        
        Args:
            tickets: List of ticket dictionaries  
            filepath: Path to output JSON file
        """
        if not tickets:
            print("✗ No tickets to save")
            return
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(filepath) if os.path.dirname(filepath) else '.', exist_ok=True)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(tickets, f, indent=2, default=str)
        
        print(f"✓ Saved {len(tickets)} tickets to {filepath}")


# Data schema documentation
DATA_SCHEMA = {
    "ticket": {
        "id": "Integer - Primary key",
        "ticket_number": "String - Ticket reference (e.g., TICK-2026-00001)",
        "subject": "String - Ticket subject/title",
        "description": "String - Full ticket description (main text for NLP)",
        "category": "Enum - One of: general, technical, billing, account, feature_request, hardware, software, network, login, other",
        "priority": "Enum - One of: low, medium, high, critical",
        "user_priority": "Enum - Priority selected by user (if any)",
        "ai_priority": "Enum - Priority predicted by AI",
        "status": "Enum - One of: open, in_progress, waiting_on_customer, resolved, closed, cancelled, reopened",
        "ai_classified": "Boolean - Whether AI classified this ticket",
        "ai_confidence": "Float - AI classification confidence (0.0-1.0)",
        "resolution": "String - Resolution notes (if resolved)",
        "resolved_at": "Datetime - When ticket was resolved",
        "created_at": "Datetime - When ticket was created",
        "time_to_resolution_hours": "Float - Hours from creation to resolution",
        "user_previous_tickets": "Integer - Count of user's previous tickets",
        "comment_count": "Integer - Number of comments on ticket"
    },
    "target_variables": {
        "category": "Classification target - ticket type/category",
        "priority": "Classification target - urgency level"
    },
    "derived_features": {
        "time_to_resolution_hours": "Regression target - prediction of resolution time",
        "reopen_count": "Quality metric - how often ticket was reopened"
    }
}


if __name__ == "__main__":
    # Example usage
    from dotenv import load_dotenv
    load_dotenv()
    
    exporter = DataExporter()
    if exporter.connect():
        stats = exporter.get_ticket_statistics()
        print("\nDatabase Statistics:")
        print(json.dumps(stats, indent=2))
        
        tickets = exporter.export_tickets(limit=100)
        if tickets:
            exporter.save_to_csv(tickets, '../data/raw/tickets.csv')
            exporter.save_to_json(tickets, '../data/raw/tickets.json')
        
        exporter.disconnect()
