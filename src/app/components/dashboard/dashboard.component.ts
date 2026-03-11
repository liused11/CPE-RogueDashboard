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
    DialogModule
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

  constructor(
    private supabaseService: SupabaseService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadDashboardData();
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
