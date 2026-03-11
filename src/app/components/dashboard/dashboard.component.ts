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
    AutoCompleteModule
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
        this.alerts = data.alerts || [];
        this.whitelist = data.whitelist || [];
        this.totalAlerts = data.total_alerts || 0;
        this.totalWhitelist = data.total_whitelist || 0;
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

  setView(view: 'alerts' | 'whitelist') {
    this.currentView = view;
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
      
      // Update local array
      this.whitelist = [
        ...this.whitelist,
        { 
          ssid: this.newWhitelist.ssid, 
          mac_address: this.newWhitelist.mac_address, 
          encryption: this.newWhitelist.encryption,
          created_at: new Date().toISOString()
        }
      ];
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
      
      // Dynamically remove row from alerts
      this.alerts = this.alerts.filter(a => a.mac_address !== alert.mac_address || a.ssid !== alert.ssid);
      
      // Add the alert to the local whitelist array
      this.whitelist = [
        ...this.whitelist,
        { ...alert, created_at: new Date().toISOString() } // or trust timestamp
      ];
      
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
