import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface DashboardData {
  alerts: any[];
  whitelist: any[];
  total_alerts: number;
  total_whitelist: number;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private http: HttpClient) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  getDashboardData(): Observable<DashboardData> {
    const url = `${environment.supabaseUrl}/functions/v1/get-dashboard-data`;
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${environment.supabaseKey}`
    });
    
    return this.http.get<DashboardData>(url, { headers });
  }

  async trustAlert(ssid: string, mac_address: string, encryption: string, channel: string = ''): Promise<any> {
    const { data, error } = await this.supabase
      .from('whitelist')
      .insert([
        { ssid, mac_address, encryption, channel }
      ]);
      
    if (error) {
      throw error;
    }
    
    return data;
  }
}
