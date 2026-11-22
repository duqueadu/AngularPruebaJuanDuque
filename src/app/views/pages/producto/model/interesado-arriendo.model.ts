export type EstadoSolicitud = 'PENDIENTE' | 'EN_ESTUDIO' | 'APROBADO' | 'RECHAZADO';

export interface InteresadoArriendo {
  id?: number;
  productoId: number;
  usuarioId: number;
  tipoDocumento: string;
  cedula: string;
  nacionalidad: string;
  lugarOrigen: string;
  ciudadActual: string;
  direccionActual: string;
  empresaTrabajo: string;
  cargoOcupacion: string;
  tiempoLaborando: string;
  ingresosMensuales: number;
  duracionContrato: string;
  fechaIngreso: string; // Formato 'YYYY-MM-DD'
  cantidadHabitantes: number;
  tieneMascotas?: string;
  codeudorNombre: string;
  codeudorCedula: string;
  codeudorTelefono: string;
  codeudorEmpresa: string;
  codeudorIngresos: number;
  observaciones?: string;
  estado?: EstadoSolicitud;
  fechaRegistro?: string;
}

export interface SolicitudArriendoDetalle {
  arriendo_id: number;
  product_id: number;
  product_title: string;
  canon_mensual: number;
  image_urls?: string;
  usuario_id: number;
  usuario_nombre: string;
  usuario_email: string;
  tipo_documento: string;
  cedula: string;
  nacionalidad: string;
  ciudad_actual: string;
  empresa_trabajo: string;
  cargo_ocupacion: string;
  tiempo_laborando: string;
  ingresos_mensuales: number;
  duracion_contrato: string;
  fecha_ingreso: string;
  cantidad_habitantes: number;
  tiene_mascotas?: string;
  codeudor_nombre: string;
  codeudor_cedula: string;
  codeudor_telefono: string;
  codeudor_empresa: string;
  codeudor_ingresos: number;
  observaciones?: string;
  estado: EstadoSolicitud;
  fecha_registro: string;
}
