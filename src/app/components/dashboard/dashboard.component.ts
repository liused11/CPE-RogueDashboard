import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService, DashboardData } from '../../services/supabase.service';
import { MessageService } from 'primeng/api';

// PrimeNG Modules
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { DatePickerModule } from 'primeng/datepicker';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    CardModule,
    ButtonModule,
    ToastModule,
    SelectModule,
    InputTextModule,
    FormsModule,
    DialogModule,
    AutoCompleteModule,
    DatePickerModule
  ],
  providers: [MessageService],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  alerts: any[] = [];
  whitelist: any[] = [];
  totalAlerts: number = 0;
  totalWhitelist: number = 0;
  loading: boolean = true;
  
  // Original data for filtering
  originalAlerts: any[] = [];
  originalWhitelist: any[] = [];

  selectedDate: Date | undefined;
  
  alertTypes = [
    { label: 'Rogue AP', value: 'Rogue AP' },
    { label: 'Evil Twin', value: 'Evil Twin' },
    { label: 'Deauth Attack', value: 'Deauth Attack' },
  ];
  
  // Track which table to show
  currentView: 'alerts' | 'whitelist' = 'alerts';

  // Modal Properties
  displayAddModal: boolean = false;
  newWhitelist = {
    ssid: '',
    mac_address: '',
    encryption: 'WPA2'
  };
  encryptionOptions = [
    { label: 'WPA3', value: 'WPA3' },
    { label: 'WPA2', value: 'WPA2' },
    { label: 'WPA', value: 'WPA' },
    { label: 'WEP', value: 'WEP' },
    { label: 'Open', value: 'Open' }
  ];

  // Simulator Modal
  displaySimulatorModal: boolean = false;
  
  // Search Autocomplete
  searchQuery: any;
  filteredSuggestions: string[] = [];
  
  constructor(
    private supabaseService: SupabaseService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadDashboardData();
  }

  filterSearch(event: any) {
    let query = event.query.toLowerCase();
    
    // Combine all SSIDs and MACs from both lists, ignoring undefined/nulls
    let allStrings: string[] = [];
    
    // Collect from alerts
    this.alerts.forEach(item => {
        if (item.ssid) allStrings.push(item.ssid);
        if (item.mac_address) allStrings.push(item.mac_address);
    });
    
    // Collect from whitelist
    this.whitelist.forEach(item => {
        if (item.ssid) allStrings.push(item.ssid);
        if (item.mac_address) allStrings.push(item.mac_address);
    });
    
    // Get unique values only
    let uniqueSuggestions = [...new Set(allStrings)];
    
    // Filter matching query
    this.filteredSuggestions = uniqueSuggestions.filter(val => 
        val.toLowerCase().includes(query)
    );
  }

  onSearchSelect(event: any, tableRef: any) {
     // event contains the raw string selected
     tableRef.filterGlobal(event, 'contains');
  }

  onSearchClear(tableRef: any) {
     tableRef.filterGlobal('', 'contains');
  }

  loadDashboardData() {
    this.loading = true;
    this.supabaseService.getDashboardData().subscribe({
      next: (data: DashboardData) => {
        this.originalAlerts = data.alerts || [];
        this.originalWhitelist = data.whitelist || [];
        this.totalAlerts = data.total_alerts || 0;
        this.totalWhitelist = data.total_whitelist || 0;
        
        this.applyDateFilter();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching dashboard data:', err);
        this.messageService.add({ 
            severity: 'error', 
            summary: 'Error', 
            detail: 'Failed to load dashboard data. Ensure your Edge Function is up and accessible.' 
        });
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyDateFilter() {
    if (!this.selectedDate) {
      this.alerts = [...this.originalAlerts];
      this.whitelist = [...this.originalWhitelist];
    } else {
      const filterDate = new Date(this.selectedDate);
      filterDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(filterDate);
      nextDate.setDate(nextDate.getDate() + 1);

      this.alerts = this.originalAlerts.filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= filterDate && itemDate < nextDate;
      });

      this.whitelist = this.originalWhitelist.filter(item => {
        const itemDate = new Date(item.created_at);
        return itemDate >= filterDate && itemDate < nextDate;
      });
    }
  }

  onDateSelect() {
    this.applyDateFilter();
  }

  onDateClear() {
    this.selectedDate = undefined;
    this.applyDateFilter();
  }

  setView(view: 'alerts' | 'whitelist') {
    this.currentView = view;
  }

  exportToCSV() {
    const data = this.currentView === 'alerts' ? this.alerts : this.whitelist;
    if (!data || data.length === 0) {
      this.messageService.add({ severity: 'info', summary: 'No Data', detail: 'There is no data to export.' });
      return;
    }

    const headers = ['Type', 'SSID', 'MAC Address', 'Details', 'Encryption', 'Date'];
    const rows = data.map(item => [
      this.currentView === 'alerts' ? (item.alert_type || 'Rogue AP') : 'Trusted',
      item.ssid || '',
      item.mac_address || '',
      item.details || '',
      item.encryption || '',
      item.created_at ? new Date(item.created_at).toLocaleString() : ''
    ]);

    let csvContent = '\uFEFF'; // Bom for Excel Thai support
    csvContent += headers.join(',') + '\n';
    rows.forEach(row => {
      const formattedRow = row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',');
      csvContent += formattedRow + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `wids_log_${this.currentView}_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  showAddModal() {
    this.displayAddModal = true;
  }

  async manualSaveWhitelist() {
    if (!this.newWhitelist.ssid || !this.newWhitelist.mac_address) {
      this.messageService.add({ severity: 'warn', summary: 'Validation Error', detail: 'SSID and MAC Address are required.' });
      return;
    }
    
    try {
      // Call service using trustAlert logic
      await this.supabaseService.trustAlert(
        this.newWhitelist.ssid, 
        this.newWhitelist.mac_address, 
        this.newWhitelist.encryption
      );
      
      // Update original array
      this.originalWhitelist = [
        ...this.originalWhitelist,
        { 
          ssid: this.newWhitelist.ssid, 
          mac_address: this.newWhitelist.mac_address, 
          encryption: this.newWhitelist.encryption,
          created_at: new Date().toISOString()
        }
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      this.applyDateFilter();
      this.totalWhitelist++;
      
      // Hide and reset
      this.displayAddModal = false;
      this.newWhitelist = { ssid: '', mac_address: '', encryption: 'WPA2' };
      
      this.messageService.add({ severity: 'success', summary: 'Successfully added to Whitelist', detail: 'Manual entry saved.' });
    } catch (error) {
      console.error('Error adding to whitelist manually:', error);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not manually add to whitelist.' });
    }
  }

  showSimulatorModal() {
    this.displaySimulatorModal = true;
  }

  async injectPayload(filename: string) {
    try {
      const response = await fetch('http://127.0.0.1:8000/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_file: filename })
      });
      const data = await response.json();
      
      if (data.status === 'success') {
        this.messageService.add({ 
            severity: 'success', 
            summary: 'Payload Injected', 
            detail: `Successfully injected ${filename}. demo_scanner.py will detect it shortly.` 
        });
        // We do not close the modal automatically so the user can send multiple payloads
      } else {
        this.messageService.add({ severity: 'error', summary: 'Injection Error', detail: data.message });
      }
    } catch (error) {
      console.error('Error injecting payload:', error);
      this.messageService.add({ 
          severity: 'error', 
          summary: 'Network Error', 
          detail: 'Could not connect to the Simulator API. Is web_simulator.py running?' 
      });
    }
  }

  async trustAlert(alert: any) {
    try {
      await this.supabaseService.trustAlert(alert.ssid, alert.mac_address, alert.encryption);
      
      // Update original arrays
      this.originalAlerts = this.originalAlerts.filter(a => a.mac_address !== alert.mac_address || a.ssid !== alert.ssid);
      this.originalWhitelist = [
        ...this.originalWhitelist,
        { ...alert, created_at: new Date().toISOString() }
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      this.applyDateFilter();
      
      // Update counts
      this.totalAlerts--;
      this.totalWhitelist++;

      // Show PrimeNG success toast
      this.messageService.add({ 
        severity: 'success', 
        summary: 'Added to Whitelist', 
        detail: `Successfully trusted ${alert.ssid || alert.mac_address}` 
      });
      
    } catch (error) {
      console.error('Error trusting alert:', error);
      this.messageService.add({ 
        severity: 'error', 
        summary: 'Error', 
        detail: 'Failed to add to whitelist' 
      });
    }
  }
}
