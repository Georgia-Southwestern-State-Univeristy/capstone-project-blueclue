"""
Exploratory Data Analysis (EDA) Module
======================================

Generates comprehensive EDA reports and visualizations for ticket data.
Identifies data quality issues, distributions, and correlations.
"""

import os
import json
from typing import Dict, List, Optional, Any, Tuple
from collections import Counter
from datetime import datetime
import csv


class EDAReporter:
    """
    Generates Exploratory Data Analysis reports for ticket data.
    
    Creates:
    - Distribution plots for categories and priorities
    - Text statistics analysis
    - Correlation analysis between features
    - Data quality issue identification
    - Summary statistics and insights
    
    Usage:
        eda = EDAReporter()
        report = eda.analyze(tickets)
        eda.generate_report(tickets, output_dir='../data/reports/')
    """
    
    def __init__(self, use_matplotlib: bool = True):
        """
        Initialize the EDA reporter.
        
        Args:
            use_matplotlib: Whether to generate matplotlib visualizations
        """
        self.use_matplotlib = use_matplotlib
        self.matplotlib_available = False
        
        if use_matplotlib:
            try:
                import matplotlib
                matplotlib.use('Agg')  # Non-interactive backend
                import matplotlib.pyplot as plt
                import seaborn as sns
                self.plt = plt
                self.sns = sns
                self.matplotlib_available = True
            except ImportError:
                print("⚠ matplotlib/seaborn not available. Install with: pip install matplotlib seaborn")
                self.matplotlib_available = False
    
    def analyze(self, tickets: List[Dict]) -> Dict[str, Any]:
        """
        Perform comprehensive analysis on ticket data.
        
        Args:
            tickets: List of ticket dictionaries
            
        Returns:
            Dictionary containing analysis results
        """
        if not tickets:
            return {'error': 'No data to analyze'}
        
        analysis = {
            'dataset_overview': self._analyze_overview(tickets),
            'category_analysis': self._analyze_categories(tickets),
            'priority_analysis': self._analyze_priorities(tickets),
            'text_analysis': self._analyze_text(tickets),
            'temporal_analysis': self._analyze_temporal(tickets),
            'quality_issues': self._identify_quality_issues(tickets),
            'key_insights': [],
            'generated_at': datetime.now().isoformat()
        }
        
        # Generate key insights
        analysis['key_insights'] = self._generate_insights(analysis)
        
        print(f"✓ Completed EDA analysis on {len(tickets)} tickets")
        
        return analysis
    
    def _analyze_overview(self, tickets: List[Dict]) -> Dict[str, Any]:
        """Generate dataset overview statistics."""
        return {
            'total_records': len(tickets),
            'unique_categories': len(set(t.get('category') for t in tickets if t.get('category'))),
            'unique_priorities': len(set(t.get('priority') for t in tickets if t.get('priority'))),
            'fields_present': list(tickets[0].keys()) if tickets else [],
            'records_with_resolution': sum(1 for t in tickets if t.get('resolution')),
            'records_ai_classified': sum(1 for t in tickets if t.get('ai_classified')),
            'date_range': self._get_date_range(tickets)
        }
    
    def _get_date_range(self, tickets: List[Dict]) -> Dict[str, str]:
        """Get the date range of tickets."""
        dates = []
        for t in tickets:
            created = t.get('created_at')
            if created:
                try:
                    if isinstance(created, str):
                        dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                    else:
                        dt = created
                    dates.append(dt)
                except Exception:
                    pass
        
        if dates:
            return {
                'earliest': min(dates).isoformat(),
                'latest': max(dates).isoformat(),
                'span_days': (max(dates) - min(dates)).days
            }
        return {'earliest': None, 'latest': None, 'span_days': 0}
    
    def _analyze_categories(self, tickets: List[Dict]) -> Dict[str, Any]:
        """Analyze category distribution."""
        categories = [t.get('category', 'unknown') for t in tickets]
        counter = Counter(categories)
        total = len(categories)
        
        distribution = {
            cat: {
                'count': count,
                'percentage': round(count / total * 100, 2)
            }
            for cat, count in counter.most_common()
        }
        
        counts = list(counter.values())
        return {
            'distribution': distribution,
            'total_categories': len(counter),
            'most_common': counter.most_common(3),
            'least_common': counter.most_common()[-3:] if len(counter) >= 3 else counter.most_common(),
            'imbalance_ratio': max(counts) / min(counts) if min(counts) > 0 else float('inf'),
            'class_balance_status': 'balanced' if max(counts) / min(counts) <= 2 else 'imbalanced'
        }
    
    def _analyze_priorities(self, tickets: List[Dict]) -> Dict[str, Any]:
        """Analyze priority distribution."""
        priorities = [t.get('priority', 'unknown') for t in tickets]
        counter = Counter(priorities)
        total = len(priorities)
        
        distribution = {
            pri: {
                'count': count,
                'percentage': round(count / total * 100, 2)
            }
            for pri, count in counter.most_common()
        }
        
        # Priority order for analysis
        priority_order = ['critical', 'high', 'medium', 'low']
        ordered_counts = [counter.get(p, 0) for p in priority_order]
        
        return {
            'distribution': distribution,
            'ordered_distribution': {p: counter.get(p, 0) for p in priority_order},
            'total_priorities': len(counter),
            'most_common': counter.most_common(1)[0] if counter else None,
            'critical_percentage': round(counter.get('critical', 0) / total * 100, 2) if total > 0 else 0,
            'high_priority_percentage': round((counter.get('critical', 0) + counter.get('high', 0)) / total * 100, 2) if total > 0 else 0
        }
    
    def _analyze_text(self, tickets: List[Dict]) -> Dict[str, Any]:
        """Analyze text content statistics."""
        descriptions = [t.get('description', '') for t in tickets]
        subjects = [t.get('subject', '') for t in tickets]
        
        desc_lengths = [len(d) for d in descriptions]
        word_counts = [len(d.split()) for d in descriptions if d]
        subject_lengths = [len(s) for s in subjects]
        
        import numpy as np
        
        return {
            'description': {
                'avg_length': round(np.mean(desc_lengths), 2) if desc_lengths else 0,
                'std_length': round(np.std(desc_lengths), 2) if desc_lengths else 0,
                'min_length': min(desc_lengths) if desc_lengths else 0,
                'max_length': max(desc_lengths) if desc_lengths else 0,
                'median_length': round(np.median(desc_lengths), 2) if desc_lengths else 0,
                'avg_word_count': round(np.mean(word_counts), 2) if word_counts else 0,
                'empty_count': sum(1 for d in descriptions if not d or len(d.strip()) == 0)
            },
            'subject': {
                'avg_length': round(np.mean(subject_lengths), 2) if subject_lengths else 0,
                'std_length': round(np.std(subject_lengths), 2) if subject_lengths else 0,
                'min_length': min(subject_lengths) if subject_lengths else 0,
                'max_length': max(subject_lengths) if subject_lengths else 0,
                'empty_count': sum(1 for s in subjects if not s or len(s.strip()) == 0)
            },
            'combined_empty': sum(1 for t in tickets if not t.get('description') and not t.get('subject'))
        }
    
    def _analyze_temporal(self, tickets: List[Dict]) -> Dict[str, Any]:
        """Analyze temporal patterns in ticket creation."""
        hour_counts = Counter()
        day_counts = Counter()
        month_counts = Counter()
        weekday_counts = Counter()
        
        business_hours = 0
        after_hours = 0
        weekend = 0
        weekday = 0
        
        for ticket in tickets:
            created = ticket.get('created_at')
            if not created:
                continue
            
            try:
                if isinstance(created, str):
                    dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                else:
                    dt = created
                
                hour_counts[dt.hour] += 1
                day_counts[dt.day] += 1
                month_counts[dt.month] += 1
                weekday_counts[dt.weekday()] += 1
                
                if 9 <= dt.hour <= 17:
                    business_hours += 1
                else:
                    after_hours += 1
                
                if dt.weekday() >= 5:
                    weekend += 1
                else:
                    weekday += 1
                    
            except Exception:
                pass
        
        total = business_hours + after_hours if (business_hours + after_hours) > 0 else 1
        
        return {
            'by_hour': dict(sorted(hour_counts.items())),
            'by_day_of_month': dict(sorted(day_counts.items())),
            'by_month': dict(sorted(month_counts.items())),
            'by_weekday': {
                'Monday': weekday_counts.get(0, 0),
                'Tuesday': weekday_counts.get(1, 0),
                'Wednesday': weekday_counts.get(2, 0),
                'Thursday': weekday_counts.get(3, 0),
                'Friday': weekday_counts.get(4, 0),
                'Saturday': weekday_counts.get(5, 0),
                'Sunday': weekday_counts.get(6, 0)
            },
            'business_hours_percentage': round(business_hours / total * 100, 2),
            'after_hours_percentage': round(after_hours / total * 100, 2),
            'weekday_percentage': round(weekday / (weekday + weekend) * 100, 2) if (weekday + weekend) > 0 else 0,
            'weekend_percentage': round(weekend / (weekday + weekend) * 100, 2) if (weekday + weekend) > 0 else 0,
            'peak_hour': hour_counts.most_common(1)[0][0] if hour_counts else None,
            'peak_day': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][weekday_counts.most_common(1)[0][0]] if weekday_counts else None
        }
    
    def _identify_quality_issues(self, tickets: List[Dict]) -> Dict[str, Any]:
        """Identify data quality issues."""
        issues = {
            'missing_descriptions': 0,
            'missing_subjects': 0,
            'missing_categories': 0,
            'missing_priorities': 0,
            'short_descriptions': 0,
            'invalid_categories': 0,
            'invalid_priorities': 0,
            'potential_duplicates': 0,
            'summary': []
        }
        
        valid_categories = {'general', 'technical', 'billing', 'account', 
                          'feature_request', 'hardware', 'software', 
                          'network', 'login', 'other'}
        valid_priorities = {'low', 'medium', 'high', 'critical'}
        
        seen_descriptions = set()
        
        for ticket in tickets:
            # Check missing fields
            if not ticket.get('description'):
                issues['missing_descriptions'] += 1
            elif len(ticket.get('description', '')) < 20:
                issues['short_descriptions'] += 1
            
            if not ticket.get('subject'):
                issues['missing_subjects'] += 1
            
            if not ticket.get('category'):
                issues['missing_categories'] += 1
            elif ticket.get('category') not in valid_categories:
                issues['invalid_categories'] += 1
            
            if not ticket.get('priority'):
                issues['missing_priorities'] += 1
            elif ticket.get('priority') not in valid_priorities:
                issues['invalid_priorities'] += 1
            
            # Check for potential duplicates
            desc = ticket.get('description', '')[:100].lower()
            if desc in seen_descriptions:
                issues['potential_duplicates'] += 1
            seen_descriptions.add(desc)
        
        # Generate summary
        total = len(tickets)
        if issues['missing_descriptions'] > total * 0.05:
            issues['summary'].append(f"High missing descriptions: {issues['missing_descriptions']} ({issues['missing_descriptions']/total*100:.1f}%)")
        
        if issues['short_descriptions'] > total * 0.10:
            issues['summary'].append(f"Many short descriptions: {issues['short_descriptions']} ({issues['short_descriptions']/total*100:.1f}%)")
        
        if issues['potential_duplicates'] > total * 0.05:
            issues['summary'].append(f"Potential duplicates detected: {issues['potential_duplicates']} ({issues['potential_duplicates']/total*100:.1f}%)")
        
        if issues['invalid_categories'] > 0:
            issues['summary'].append(f"Invalid categories: {issues['invalid_categories']}")
        
        if issues['invalid_priorities'] > 0:
            issues['summary'].append(f"Invalid priorities: {issues['invalid_priorities']}")
        
        issues['total_issues'] = sum([
            issues['missing_descriptions'],
            issues['missing_subjects'],
            issues['missing_categories'],
            issues['missing_priorities'],
            issues['short_descriptions'],
            issues['invalid_categories'],
            issues['invalid_priorities']
        ])
        
        issues['data_quality_score'] = round(100 - (issues['total_issues'] / (total * 7) * 100), 2) if total > 0 else 0
        
        return issues
    
    def _generate_insights(self, analysis: Dict[str, Any]) -> List[str]:
        """Generate key insights from analysis."""
        insights = []
        
        # Dataset size insight
        total = analysis['dataset_overview']['total_records']
        if total < 100:
            insights.append(f"⚠ Small dataset ({total} records). Consider collecting more data for robust training.")
        elif total < 500:
            insights.append(f"Dataset size is moderate ({total} records). May need data augmentation.")
        else:
            insights.append(f"✓ Good dataset size ({total} records) for initial ML training.")
        
        # Category balance insight
        cat_status = analysis['category_analysis']['class_balance_status']
        if cat_status == 'imbalanced':
            ratio = analysis['category_analysis']['imbalance_ratio']
            insights.append(f"⚠ Category classes are imbalanced (ratio: {ratio:.1f}:1). Consider oversampling or weighted training.")
        else:
            insights.append("✓ Category classes are reasonably balanced.")
        
        # Priority distribution insight
        critical_pct = analysis['priority_analysis']['critical_percentage']
        if critical_pct > 20:
            insights.append(f"⚠ High proportion of critical tickets ({critical_pct}%). Verify if this reflects reality.")
        elif critical_pct < 2:
            insights.append(f"Note: Very few critical tickets ({critical_pct}%). May need synthetic critical examples.")
        
        # Text quality insight
        avg_length = analysis['text_analysis']['description']['avg_length']
        if avg_length < 50:
            insights.append(f"⚠ Average description length is short ({avg_length} chars). May impact classification accuracy.")
        elif avg_length > 500:
            insights.append(f"✓ Descriptions are detailed (avg {avg_length} chars). Good for feature extraction.")
        
        # Temporal insight
        biz_hours_pct = analysis['temporal_analysis']['business_hours_percentage']
        if biz_hours_pct > 80:
            insights.append(f"Most tickets created during business hours ({biz_hours_pct}%). Time features may be predictive.")
        
        # Quality insight
        quality_score = analysis['quality_issues']['data_quality_score']
        if quality_score < 80:
            insights.append(f"⚠ Data quality score is {quality_score}/100. Review and clean data before training.")
        else:
            insights.append(f"✓ Data quality score is good ({quality_score}/100).")
        
        return insights
    
    def generate_visualizations(self, tickets: List[Dict], output_dir: str):
        """Generate visualization plots."""
        if not self.matplotlib_available:
            print("⚠ Matplotlib not available. Skipping visualizations.")
            return
        
        os.makedirs(output_dir, exist_ok=True)
        
        # 1. Category Distribution
        self._plot_category_distribution(tickets, os.path.join(output_dir, 'category_distribution.png'))
        
        # 2. Priority Distribution
        self._plot_priority_distribution(tickets, os.path.join(output_dir, 'priority_distribution.png'))
        
        # 3. Text Length Distribution
        self._plot_text_length_distribution(tickets, os.path.join(output_dir, 'text_length_distribution.png'))
        
        # 4. Temporal Patterns
        self._plot_temporal_patterns(tickets, os.path.join(output_dir, 'temporal_patterns.png'))
        
        # 5. Category-Priority Heatmap
        self._plot_category_priority_heatmap(tickets, os.path.join(output_dir, 'category_priority_heatmap.png'))
        
        print(f"✓ Generated visualizations in {output_dir}")
    
    def _plot_category_distribution(self, tickets: List[Dict], filepath: str):
        """Plot category distribution."""
        categories = [t.get('category', 'unknown') for t in tickets]
        counter = Counter(categories)
        
        fig, ax = self.plt.subplots(figsize=(10, 6))
        cats, counts = zip(*counter.most_common())
        colors = self.sns.color_palette("husl", len(cats))
        
        bars = ax.bar(cats, counts, color=colors)
        ax.set_xlabel('Category')
        ax.set_ylabel('Count')
        ax.set_title('Ticket Category Distribution')
        ax.tick_params(axis='x', rotation=45)
        
        # Add count labels on bars
        for bar, count in zip(bars, counts):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 5, 
                   str(count), ha='center', va='bottom', fontsize=9)
        
        self.plt.tight_layout()
        self.plt.savefig(filepath, dpi=150)
        self.plt.close()
    
    def _plot_priority_distribution(self, tickets: List[Dict], filepath: str):
        """Plot priority distribution."""
        priorities = [t.get('priority', 'unknown') for t in tickets]
        counter = Counter(priorities)
        
        priority_order = ['low', 'medium', 'high', 'critical']
        ordered_counts = [counter.get(p, 0) for p in priority_order if p in counter]
        ordered_labels = [p for p in priority_order if p in counter]
        
        fig, ax = self.plt.subplots(figsize=(8, 6))
        colors = ['#4CAF50', '#FFC107', '#FF9800', '#F44336'][:len(ordered_labels)]
        
        wedges, texts, autotexts = ax.pie(ordered_counts, labels=ordered_labels, 
                                          colors=colors, autopct='%1.1f%%',
                                          startangle=90)
        ax.set_title('Ticket Priority Distribution')
        
        self.plt.tight_layout()
        self.plt.savefig(filepath, dpi=150)
        self.plt.close()
    
    def _plot_text_length_distribution(self, tickets: List[Dict], filepath: str):
        """Plot text length distribution."""
        desc_lengths = [len(t.get('description', '')) for t in tickets]
        
        fig, ax = self.plt.subplots(figsize=(10, 6))
        
        ax.hist(desc_lengths, bins=50, color='steelblue', edgecolor='white', alpha=0.7)
        ax.axvline(x=sum(desc_lengths)/len(desc_lengths), color='red', 
                  linestyle='--', label=f'Mean: {sum(desc_lengths)/len(desc_lengths):.0f}')
        ax.set_xlabel('Description Length (characters)')
        ax.set_ylabel('Frequency')
        ax.set_title('Ticket Description Length Distribution')
        ax.legend()
        
        self.plt.tight_layout()
        self.plt.savefig(filepath, dpi=150)
        self.plt.close()
    
    def _plot_temporal_patterns(self, tickets: List[Dict], filepath: str):
        """Plot temporal patterns."""
        hours = []
        for ticket in tickets:
            created = ticket.get('created_at')
            if created:
                try:
                    if isinstance(created, str):
                        dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
                    else:
                        dt = created
                    hours.append(dt.hour)
                except Exception:
                    pass
        
        fig, ax = self.plt.subplots(figsize=(12, 5))
        
        hour_counts = Counter(hours)
        x = range(24)
        y = [hour_counts.get(h, 0) for h in x]
        
        ax.bar(x, y, color='steelblue', edgecolor='white')
        ax.axvspan(9, 17, alpha=0.2, color='green', label='Business Hours')
        ax.set_xlabel('Hour of Day')
        ax.set_ylabel('Number of Tickets')
        ax.set_title('Ticket Creation by Hour of Day')
        ax.set_xticks(range(0, 24, 2))
        ax.legend()
        
        self.plt.tight_layout()
        self.plt.savefig(filepath, dpi=150)
        self.plt.close()
    
    def _plot_category_priority_heatmap(self, tickets: List[Dict], filepath: str):
        """Plot category-priority relationship heatmap."""
        import numpy as np
        
        categories = sorted(set(t.get('category', 'unknown') for t in tickets))
        priorities = ['low', 'medium', 'high', 'critical']
        
        # Create matrix
        matrix = np.zeros((len(categories), len(priorities)))
        for ticket in tickets:
            cat = ticket.get('category', 'unknown')
            pri = ticket.get('priority', 'medium')
            if cat in categories and pri in priorities:
                matrix[categories.index(cat)][priorities.index(pri)] += 1
        
        fig, ax = self.plt.subplots(figsize=(10, 8))
        
        im = ax.imshow(matrix, cmap='YlOrRd')
        ax.set_xticks(range(len(priorities)))
        ax.set_yticks(range(len(categories)))
        ax.set_xticklabels(priorities)
        ax.set_yticklabels(categories)
        ax.set_xlabel('Priority')
        ax.set_ylabel('Category')
        ax.set_title('Category vs Priority Heatmap')
        
        # Add text annotations
        for i in range(len(categories)):
            for j in range(len(priorities)):
                text = ax.text(j, i, int(matrix[i, j]), ha='center', va='center', color='black')
        
        self.plt.colorbar(im, label='Count')
        self.plt.tight_layout()
        self.plt.savefig(filepath, dpi=150)
        self.plt.close()
    
    def generate_report(self, 
                        tickets: List[Dict],
                        output_dir: str,
                        include_visualizations: bool = True) -> str:
        """
        Generate a complete EDA report.
        
        Args:
            tickets: List of ticket dictionaries
            output_dir: Directory to save report files
            include_visualizations: Whether to generate plot images
            
        Returns:
            Path to the main report file
        """
        os.makedirs(output_dir, exist_ok=True)
        
        # Perform analysis
        analysis = self.analyze(tickets)
        
        # Save raw analysis as JSON
        json_path = os.path.join(output_dir, 'eda_analysis.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(analysis, f, indent=2, default=str)
        
        # Generate visualizations
        if include_visualizations and self.matplotlib_available:
            viz_dir = os.path.join(output_dir, 'visualizations')
            self.generate_visualizations(tickets, viz_dir)
        
        # Generate markdown report
        report_path = os.path.join(output_dir, 'EDA_REPORT.md')
        report = self._generate_markdown_report(analysis, include_visualizations)
        
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report)
        
        print(f"✓ EDA report generated: {report_path}")
        
        return report_path
    
    def _generate_markdown_report(self, analysis: Dict[str, Any], include_visualizations: bool) -> str:
        """Generate markdown formatted report."""
        lines = []
        
        lines.append("# BlueClue Ticket Data - Exploratory Data Analysis Report")
        lines.append("")
        lines.append(f"**Generated:** {analysis['generated_at']}")
        lines.append("")
        
        # Dataset Overview
        lines.append("## 1. Dataset Overview")
        lines.append("")
        overview = analysis['dataset_overview']
        lines.append(f"- **Total Records:** {overview['total_records']}")
        lines.append(f"- **Unique Categories:** {overview['unique_categories']}")
        lines.append(f"- **Unique Priorities:** {overview['unique_priorities']}")
        lines.append(f"- **Date Range:** {overview['date_range']['earliest']} to {overview['date_range']['latest']}")
        lines.append(f"- **Records with Resolution:** {overview['records_with_resolution']}")
        lines.append(f"- **AI Classified Records:** {overview['records_ai_classified']}")
        lines.append("")
        
        # Key Insights
        lines.append("## 2. Key Insights")
        lines.append("")
        for insight in analysis['key_insights']:
            lines.append(f"- {insight}")
        lines.append("")
        
        # Category Analysis
        lines.append("## 3. Category Distribution")
        lines.append("")
        cat = analysis['category_analysis']
        lines.append(f"- **Class Balance Status:** {cat['class_balance_status']}")
        lines.append(f"- **Imbalance Ratio:** {cat['imbalance_ratio']:.2f}:1")
        lines.append("")
        lines.append("| Category | Count | Percentage |")
        lines.append("|----------|-------|------------|")
        for category, data in cat['distribution'].items():
            lines.append(f"| {category} | {data['count']} | {data['percentage']}% |")
        lines.append("")
        
        if include_visualizations:
            lines.append("![Category Distribution](visualizations/category_distribution.png)")
            lines.append("")
        
        # Priority Analysis
        lines.append("## 4. Priority Distribution")
        lines.append("")
        pri = analysis['priority_analysis']
        lines.append(f"- **Critical Tickets:** {pri['critical_percentage']}%")
        lines.append(f"- **High Priority (Critical + High):** {pri['high_priority_percentage']}%")
        lines.append("")
        lines.append("| Priority | Count | Percentage |")
        lines.append("|----------|-------|------------|")
        for priority, data in pri['distribution'].items():
            lines.append(f"| {priority} | {data['count']} | {data['percentage']}% |")
        lines.append("")
        
        if include_visualizations:
            lines.append("![Priority Distribution](visualizations/priority_distribution.png)")
            lines.append("")
        
        # Text Analysis
        lines.append("## 5. Text Analysis")
        lines.append("")
        text = analysis['text_analysis']
        lines.append("### Description Statistics")
        lines.append(f"- **Average Length:** {text['description']['avg_length']} characters")
        lines.append(f"- **Average Word Count:** {text['description']['avg_word_count']} words")
        lines.append(f"- **Min/Max Length:** {text['description']['min_length']} / {text['description']['max_length']}")
        lines.append(f"- **Empty Descriptions:** {text['description']['empty_count']}")
        lines.append("")
        
        if include_visualizations:
            lines.append("![Text Length Distribution](visualizations/text_length_distribution.png)")
            lines.append("")
        
        # Temporal Analysis
        lines.append("## 6. Temporal Patterns")
        lines.append("")
        temp = analysis['temporal_analysis']
        lines.append(f"- **Business Hours Tickets:** {temp['business_hours_percentage']}%")
        lines.append(f"- **After Hours Tickets:** {temp['after_hours_percentage']}%")
        lines.append(f"- **Weekday vs Weekend:** {temp['weekday_percentage']}% / {temp['weekend_percentage']}%")
        lines.append(f"- **Peak Hour:** {temp['peak_hour']}:00")
        lines.append(f"- **Peak Day:** {temp['peak_day']}")
        lines.append("")
        
        if include_visualizations:
            lines.append("![Temporal Patterns](visualizations/temporal_patterns.png)")
            lines.append("")
            lines.append("![Category Priority Heatmap](visualizations/category_priority_heatmap.png)")
            lines.append("")
        
        # Data Quality
        lines.append("## 7. Data Quality Assessment")
        lines.append("")
        quality = analysis['quality_issues']
        lines.append(f"**Data Quality Score:** {quality['data_quality_score']}/100")
        lines.append("")
        lines.append("### Issues Detected")
        lines.append(f"- Missing Descriptions: {quality['missing_descriptions']}")
        lines.append(f"- Missing Subjects: {quality['missing_subjects']}")
        lines.append(f"- Short Descriptions (<20 chars): {quality['short_descriptions']}")
        lines.append(f"- Potential Duplicates: {quality['potential_duplicates']}")
        lines.append(f"- Invalid Categories: {quality['invalid_categories']}")
        lines.append(f"- Invalid Priorities: {quality['invalid_priorities']}")
        lines.append("")
        
        if quality['summary']:
            lines.append("### Summary")
            for item in quality['summary']:
                lines.append(f"- {item}")
        lines.append("")
        
        # Recommendations
        lines.append("## 8. Recommendations for ML Training")
        lines.append("")
        
        if cat['class_balance_status'] == 'imbalanced':
            lines.append("1. **Balance Classes:** Use oversampling (SMOTE) or class weights during training")
        
        if pri['critical_percentage'] < 5:
            lines.append("2. **Augment Critical Examples:** Generate or collect more critical priority tickets")
        
        if text['description']['avg_length'] < 100:
            lines.append("3. **Enhance Text Features:** Consider using word embeddings due to short texts")
        
        if quality['data_quality_score'] < 90:
            lines.append("4. **Clean Data:** Address data quality issues before training")
        
        lines.append("5. **Feature Engineering:** Utilize temporal features (hour, day) as they show patterns")
        lines.append("6. **Cross-Validation:** Use stratified k-fold CV due to class imbalance")
        lines.append("")
        
        lines.append("---")
        lines.append("*Report generated by BlueClue ML Pipeline*")
        
        return "\n".join(lines)


if __name__ == "__main__":
    # Example usage
    from synthetic_generator import SyntheticDataGenerator
    from preprocessor import DataPreprocessor
    
    # Generate and preprocess data
    generator = SyntheticDataGenerator(seed=42)
    raw_tickets = generator.generate(n_samples=500)
    
    preprocessor = DataPreprocessor()
    clean_tickets = preprocessor.preprocess(raw_tickets)
    
    # Generate EDA report
    eda = EDAReporter(use_matplotlib=True)
    report_path = eda.generate_report(clean_tickets, '../data/reports/')
    
    print(f"\nEDA Report saved to: {report_path}")
