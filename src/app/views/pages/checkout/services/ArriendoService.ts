import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { LocalstorageService } from '../../auth/services/localstorage.service';

@Injectable({
  providedIn: 'root'
})
export class ArriendoService {

  private readonly baseUrl = `${environment.api}arriendos`;

  constructor(
    private _http: HttpClient,
    private _localstorageService: LocalstorageService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this._localstorageService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // 1. Registrar una nueva solicitud de arriendo (POST /api/arriendos)
  crearArriendo(solicitud: any): Observable<any> {
    return this._http.post<any>(this.baseUrl, solicitud, {
      headers: this.getAuthHeaders()
    });
  }

  // 2. Listar todas las solicitudes con detalle o filtrar por productoId (GET /api/arriendos)
  getArriendos(productoId?: number): Observable<any> {
    let params = new HttpParams();
    if (productoId !== undefined && productoId !== null) {
      params = params.set('productoId', productoId.toString());
    }
    return this._http.get<any>(this.baseUrl, {
      headers: this.getAuthHeaders(),
      params
    });
  }

  // 3. Obtener el detalle completo con JOIN de una solicitud por ID (GET /api/arriendos/detalle/{id})
  getArriendoDetalleById(id: number): Observable<any> {
    return this._http.get<any>(`${this.baseUrl}/detalle/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  // 4. Obtener una solicitud por su ID (GET /api/arriendos/{id})
  getArriendoById(id: number): Observable<any> {
    return this._http.get<any>(`${this.baseUrl}/${id}`, {
      headers: this.getAuthHeaders()
    });
  }

  // 5. Listar las solicitudes realizadas por un usuario específico (GET /api/arriendos/usuario/{usuarioId})
  getArriendosByUsuario(usuarioId: number): Observable<any> {
    return this._http.get<any>(`${this.baseUrl}/usuario/${usuarioId}`, {
      headers: this.getAuthHeaders()
    });
  }

  // 6. Actualizar el estado de una solicitud: PENDIENTE, EN_ESTUDIO, APROBADO, RECHAZADO (PATCH /api/arriendos/{id}/estado)
  actualizarEstadoArriendo(id: number, estado: string): Observable<any> {
    return this._http.patch<any>(
      `${this.baseUrl}/${id}/estado`,
      { estado },
      { headers: this.getAuthHeaders() }
    );
  }

  // 7. Eliminar una solicitud de arriendo (DELETE /api/arriendos/{id})
  eliminarArriendo(id: number): Observable<any> {
    return this._http.delete<any>(`${this.baseUrl}/${id}`, {
      headers: this.getAuthHeaders()
    });
  }
}
