import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Observable, of, forkJoin } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { CartItem } from '../../models/cart';
import { CartService } from '../../services/cart.service';
import { UserService } from '../../../pages/user/services/user.service';
import { AuthService } from '../../auth/services/auth.service';
import { ArriendoService } from '../services/ArriendoService';

export interface HabitanteFamilia {
  esMayorDeEdad: boolean;
  nombre: string;
  edad: number | null;
  tipoDocumento: string;
  documento: string;
  telefono?: string;
  nombreEmpresa?: string;
  duracion?: string;
}

export interface TrabajadorBodega {
  esMayorDeEdad: true;
  nombre: string;
  edad: number | null;
  tipoDocumento: string;
  documento: string;
  telefono: string;
  nombreEmpresa: string;
  duracion: string;
}

@Component({
  selector: 'app-checkout-page',
  templateUrl: './checkout-page.component.html',
  styleUrls: ['./checkout-page.component.css']
})
export class CheckoutPageComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  readonly MAX_ADULTOS = 4;
  readonly MAX_NINOS = 3;
  readonly MAX_TOTAL_PERSONAS = 5;

  checkoutFormGroup!: FormGroup;
  personaModalFormGroup!: FormGroup;

  isSubmitted = false;
  isSubmittingOrder = false;
  submitErrorMessage: string = '';
  passwordVisible: boolean = false;
  confirmPasswordVisible: boolean = false;

  currentStep: number = 1;

  cartList: CartItem[] = [];
  totalPrice: number = 0;
  isCartEmpty: boolean = false;

  hasActiveSession: boolean = false;
  isLoadingSession: boolean = false;
  sessionUser: any = null;

  habitantesFamilia: HabitanteFamilia[] = [];
  trabajadoresBodega: TrabajadorBodega[] = [];

  isPersonaModalOpen: boolean = false;
  personaModalSubmitted: boolean = false;
  personasErrorMessage: string = '';

  constructor(
    private router: Router,
    private _cartService: CartService,
    private _userService: UserService,
    private _authService: AuthService,
    private _arriendoService: ArriendoService,
    private formBuilder: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {}

  private normalizeText(val: any): string {
    return String(val ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  private getCategoryName(item: any): string {
    return (
      item?.product?.category?.name ||
      item?.product?.categoryName ||
      item?.category?.name ||
      item?.categoryName ||
      ''
    );
  }

  private getCategoryId(item: any): number {
    return Number(
      item?.product?.category?.id ??
      item?.product?.categoryId ??
      item?.category?.id ??
      item?.categoryId ??
      0
    );
  }

  private getProductId(item: any): number {
    return Number(item?.product?.id ?? item?.productId ?? item?.id ?? 0);
  }

  getItemProductId(item: any): string | number {
    const id = this.getProductId(item);
    return id > 0 ? id : '-';
  }

  getProductTitle(item: any): string {
    return (
      item?.product?.name ||
      item?.product?.title ||
      item?.name ||
      item?.title ||
      'Producto / Inmueble'
    );
  }

  getProductImage(item: any): string {
    const raw =
      item?.product?.image ||
      item?.product?.imageUrl ||
      item?.product?.thumbnail ||
      item?.product?.photo ||
      (Array.isArray(item?.product?.images) ? item.product.images[0]?.url || item.product.images[0] : '') ||
      item?.image ||
      '';
    return String(raw || '').trim();
  }

  getProductCategoryLabel(item: any): string {
    return this.getCategoryName(item) || (this.getCategoryId(item) === 6 ? 'Bienes Raíces / Inmuebles' : 'General');
  }

  get esBienesRaices(): boolean {
    if (!this.cartList || this.cartList.length === 0) return false;
    return this.cartList.some((item: any) => {
      const catNorm = this.normalizeText(this.getCategoryName(item));
      const catId = this.getCategoryId(item);
      const prodId = this.getProductId(item);
      return (
        catNorm.includes('bienes raices') ||
        catNorm.includes('inmueble') ||
        catId === 6 ||
        catId === 12 ||
        prodId === 12 ||
        prodId === 13 ||
        prodId === 14 ||
        prodId === 15
      );
    });
  }

  /**
   * ID producto 13, 14 o 15 y categoría Bienes Raíces / Inmuebles (o catId 6)
   */
  get esHabitantesFamilia13_14_15(): boolean {
    if (!this.cartList || this.cartList.length === 0) return false;
    return this.cartList.some((item: any) => {
      const prodId = this.getProductId(item);
      const catNorm = this.normalizeText(this.getCategoryName(item));
      const catId = this.getCategoryId(item);
      const esCatInmuebles =
        catNorm.includes('bienes raices') ||
        catNorm.includes('inmueble') ||
        catId === 6;
      return esCatInmuebles && (prodId === 13 || prodId === 14 || prodId === 15);
    });
  }

  /**
   * Detecta si la solicitud es de Bodega
   */
  get esBodega(): boolean {
    if (!this.cartList || this.cartList.length === 0) return false;
    return this.cartList.some((item: any) => {
      const prodId = this.getProductId(item);
      const titleNorm = this.normalizeText(this.getProductTitle(item));
      const catNorm = this.normalizeText(this.getCategoryName(item));
      return prodId === 12 || titleNorm.includes('bodega') || catNorm.includes('bodega');
    });
  }

  get adultosCount(): number {
    return this.habitantesFamilia.filter(h => h.esMayorDeEdad).length;
  }

  get ninosCount(): number {
    return this.habitantesFamilia.filter(h => !h.esMayorDeEdad).length;
  }

  get puedeAgregarMasFamilia(): boolean {
    if (this.habitantesFamilia.length >= this.MAX_TOTAL_PERSONAS) return false;
    return this.adultosCount < this.MAX_ADULTOS || this.ninosCount < this.MAX_NINOS;
  }

  get areBasicUserFieldsComplete(): boolean {
    const f = this.checkoutFormGroup;
    if (!f) return false;
    const fn = f.get('firstName');
    const ln = f.get('lastName');
    const ph = f.get('phone');
    const em = f.get('email');
    return !!(fn?.valid && ln?.valid && ph?.valid && em?.valid);
  }

  canAddMoreStock(product: any, currentQtyInCart: number = 1): boolean {
    const stock = Number(product?.stock ?? product?.quantityAvailable ?? product?.availableStock);
    if (isNaN(stock)) return true;
    if (stock <= 1) return false;
    return currentQtyInCart < stock;
  }

  ngOnInit(): void {
    this.initCheckoutForm();
    this.initPersonaModalForm();
    this.subscribeToCart();
    this.validateJwtTokenAndLoadSession();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initCheckoutForm(): void {
    this.checkoutFormGroup = this.formBuilder.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.email, Validators.required]],
      phone: ['', Validators.required],
      password: [''],
      confirmPassword: [''],

      message: [''],
      deliveryMethod: ['express'],
      city: ['Bogotá'],
      postalcode: [''],
      zip: [''],
      house: [''],
      address: [''],

      tipoDocumento: ['CC'],
      cedula: [''],
      nacionalidad: ['Colombiana'],
      lugarOrigen: [''],
      direccionActual: [''],
      ciudadActual: ['Bogotá'],
      empresaTrabajo: [''],
      cargoOcupacion: [''],
      tiempoLaborando: [''],
      ingresosMensuales: [null],
      duracionContrato: ['12 meses'],
      fechaIngreso: [''],
      cantidadHabitantes: [1],
      tieneMascotas: ['No'],
      codeudorNombre: [''],
      codeudorCedula: [''],
      codeudorTelefono: [''],
      codeudorEmpresa: [''],
      codeudorIngresos: [null]
    }, { validators: this.passwordMatchValidator });
  }

  private initPersonaModalForm(): void {
    this.personaModalFormGroup = this.formBuilder.group({
      esMayorDeEdad: [true, Validators.required],
      nombre: ['', Validators.required],
      edad: [null, [Validators.required, Validators.min(0), Validators.max(120)]],
      tipoDocumento: ['CC', Validators.required],
      documento: ['', Validators.required],
      telefono: [''],
      nombreEmpresa: [''],
      duracion: ['']
    });
  }

  private passwordMatchValidator(control: AbstractControl): { [key: string]: boolean } | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    const confirmCtrl = control.get('confirmPassword');

    if (password && confirmPassword && password !== confirmPassword) {
      confirmCtrl?.setErrors({ ...(confirmCtrl.errors || {}), passwordMismatch: true });
      return { passwordMismatch: true };
    }

    if (confirmCtrl?.hasError('passwordMismatch')) {
      const { passwordMismatch, ...rest } = confirmCtrl.errors || {};
      confirmCtrl.setErrors(Object.keys(rest).length ? rest : null);
    }
    return null;
  }

  private validateJwtTokenAndLoadSession(): void {
    const jwtToken = localStorage.getItem('jwtToken') || localStorage.getItem('token');

    if (!jwtToken || !jwtToken.trim()) {
      this.hasActiveSession = false;
      this.sessionUser = null;
      this.currentStep = 1;
      return;
    }

    const payload = this.decodeJwtPayload(jwtToken);
    if (payload && this.isTokenExpired(payload)) {
      this.hasActiveSession = false;
      this.sessionUser = null;
      this.currentStep = 1;
      return;
    }

    this.isLoadingSession = true;

    this._userService
      .getUser()
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => {
          this.hasActiveSession = false;
          this.sessionUser = null;
          this.isLoadingSession = false;
          this.currentStep = 1;
          this.cdr.detectChanges();
          return of(null);
        })
      )
      .subscribe((user: any) => {
        this.isLoadingSession = false;

        if (!user || Object.keys(user).length === 0) {
          this.hasActiveSession = false;
          this.sessionUser = null;
          this.currentStep = 1;
          this.cdr.detectChanges();
          return;
        }

        this.hasActiveSession = true;
        this.sessionUser = user;
        this.patchUserToForm(user);
        this.currentStep = 2;
        this.cdr.detectChanges();
      });
  }

  private patchUserToForm(user: any): void {
    const fullName: string = (user.name || user.nombre || '').trim();
    const nameParts = fullName ? fullName.split(' ') : [];
    const firstName = user.firstName || user.nombres || (nameParts.length > 0 ? nameParts[0] : '');
    const lastName = user.lastName || user.apellidos || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');

    this.checkoutFormGroup.patchValue({
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(user.email || user.correo ? { email: user.email || user.correo } : {}),
      ...(user.phone || user.telefono || user.celular ? { phone: user.phone || user.telefono || user.celular } : {}),
      ...(user.cedula || user.documento ? { cedula: user.cedula || user.documento } : {})
    });
  }

  private decodeJwtPayload(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
    } catch {
      return null;
    }
  }

  private isTokenExpired(payload: any): boolean {
    if (!payload?.exp) return false;
    return payload.exp < Math.floor(Date.now() / 1000);
  }

  private subscribeToCart(): void {
    this._cartService.cart$
      .pipe(takeUntil(this.destroy$))
      .subscribe((cart: any) => {
        this.cartList = cart?.items || [];
        this.isCartEmpty = this.cartList.length === 0;

        this.totalPrice = this.cartList.reduce((acc: number, item: any) => {
          const price = Number(item?.product?.price ?? item?.price ?? 0);
          const qty = Number(item?.quantity ?? 1);
          return acc + price * qty;
        }, 0);
      });
  }

  get checkoutForm() {
    return this.checkoutFormGroup.controls;
  }

  togglePasswordVisibility(): void {
    this.passwordVisible = !this.passwordVisible;
  }

  toggleConfirmPasswordVisibility(): void {
    this.confirmPasswordVisible = !this.confirmPasswordVisible;
  }

  abrirModalPersona(): void {
    this.personasErrorMessage = '';
    this.personaModalSubmitted = false;

    if (this.esBodega) {
      this.personaModalFormGroup.reset({
        esMayorDeEdad: true,
        nombre: '',
        edad: 25,
        tipoDocumento: 'CC',
        documento: '',
        telefono: '',
        nombreEmpresa: '',
        duracion: ''
      });
      this.isPersonaModalOpen = true;
      this.cdr.detectChanges();
      return;
    }

    if (this.habitantesFamilia.length >= this.MAX_TOTAL_PERSONAS) {
      this.personasErrorMessage = `Solo se permiten máximo ${this.MAX_TOTAL_PERSONAS} integrantes en la familia.`;
      return;
    }

    if (!this.puedeAgregarMasFamilia) {
      this.personasErrorMessage = `Ya alcanzó el límite permitido (máx. ${this.MAX_ADULTOS} adultos, máx. ${this.MAX_NINOS} niños y máx. ${this.MAX_TOTAL_PERSONAS} en total).`;
      return;
    }

    const defaultMayor = this.adultosCount < this.MAX_ADULTOS;
    this.personaModalFormGroup.reset({
      esMayorDeEdad: defaultMayor,
      nombre: '',
      edad: defaultMayor ? 25 : 8,
      tipoDocumento: defaultMayor ? 'CC' : 'TI',
      documento: '',
      telefono: '',
      nombreEmpresa: '',
      duracion: ''
    });
    this.isPersonaModalOpen = true;
    this.cdr.detectChanges();
  }

  cerrarModalPersona(): void {
    this.isPersonaModalOpen = false;
    this.personaModalSubmitted = false;
    this.cdr.detectChanges();
  }

  guardarPersonaDesdeModal(): void {
    this.personaModalSubmitted = true;
    this.personasErrorMessage = '';

    const v = this.personaModalFormGroup.value;
    const nombre = (v.nombre || '').trim();
    const edad = v.edad !== null && v.edad !== '' && !isNaN(Number(v.edad)) ? Number(v.edad) : null;
    const tipoDocumento = (v.tipoDocumento || '').trim();
    const documento = (v.documento || '').trim();

    if (!nombre || edad === null || !tipoDocumento || !documento) {
      this.personaModalFormGroup.markAllAsTouched();
      this.personasErrorMessage = 'Complete nombre, edad, tipo de documento y número de documento.';
      return;
    }

    if (this.esBodega) {
      const telefono = (v.telefono || '').trim();
      const nombreEmpresa = (v.nombreEmpresa || '').trim();
      const duracion = (v.duracion || '').trim();

      if (edad < 18) {
        this.personasErrorMessage = 'Para bodega no se permiten menores de edad; solo trabajadores mayores de edad.';
        return;
      }

      if (!telefono || !nombreEmpresa || !duracion) {
        this.personasErrorMessage = 'Para trabajador debe indicar dónde trabaja (empresa), duración y teléfono.';
        return;
      }

      const nuevoTrabajador: TrabajadorBodega = {
        esMayorDeEdad: true,
        nombre,
        edad,
        tipoDocumento,
        documento,
        telefono,
        nombreEmpresa,
        duracion
      };

      this.trabajadoresBodega = [...this.trabajadoresBodega, nuevoTrabajador];
      this.actualizarConteoPersonas();
      this.cerrarModalPersona();
      return;
    }

    if (this.habitantesFamilia.length >= this.MAX_TOTAL_PERSONAS) {
      this.personasErrorMessage = `No se pueden agregar más de ${this.MAX_TOTAL_PERSONAS} integrantes en la familia.`;
      return;
    }

    const esMayor = Boolean(v.esMayorDeEdad);

    if (esMayor && this.adultosCount >= this.MAX_ADULTOS) {
      this.personasErrorMessage = `Solo se pueden agregar máximo ${this.MAX_ADULTOS} adultos.`;
      return;
    }

    if (!esMayor && this.ninosCount >= this.MAX_NINOS) {
      this.personasErrorMessage = `Solo se pueden agregar máximo ${this.MAX_NINOS} niños (menores de edad).`;
      return;
    }

    if (esMayor) {
      const telefono = (v.telefono || '').trim();
      const nombreEmpresa = (v.nombreEmpresa || '').trim();
      const duracion = (v.duracion || '').trim();

      if (!telefono || !nombreEmpresa || !duracion) {
        this.personasErrorMessage = 'Si es mayor de edad debe ingresar teléfono, nombre de la empresa y duración.';
        return;
      }

      const adulto: HabitanteFamilia = {
        esMayorDeEdad: true,
        nombre,
        edad,
        tipoDocumento,
        documento,
        telefono,
        nombreEmpresa,
        duracion
      };

      this.habitantesFamilia = [...this.habitantesFamilia, adulto];
    } else {
      const nino: HabitanteFamilia = {
        esMayorDeEdad: false,
        nombre,
        edad,
        tipoDocumento,
        documento
      };

      this.habitantesFamilia = [...this.habitantesFamilia, nino];
    }

    this.actualizarConteoPersonas();
    this.cerrarModalPersona();
  }

  eliminarHabitanteFamilia(index: number): void {
    if (index < 0 || index >= this.habitantesFamilia.length) return;
    this.habitantesFamilia = this.habitantesFamilia.filter((_, i) => i !== index);
    this.personasErrorMessage = '';
    this.actualizarConteoPersonas();
  }

  eliminarTrabajadorBodega(index: number): void {
    if (index < 0 || index >= this.trabajadoresBodega.length) return;
    this.trabajadoresBodega = this.trabajadoresBodega.filter((_, i) => i !== index);
    this.personasErrorMessage = '';
    this.actualizarConteoPersonas();
  }

  private actualizarConteoPersonas(): void {
    const totalPersonas = this.esBodega
      ? (this.trabajadoresBodega.length || 1)
      : (this.habitantesFamilia.length || 1);

    this.checkoutFormGroup.patchValue({
      cantidadHabitantes: totalPersonas
    });
    this.cdr.detectChanges();
  }

  private buildInteresadoArriendoPayload(productoId: number, usuarioId: number): any {
    const form = this.checkoutFormGroup.value;

    return {
      productoId,
      usuarioId,
      tipoDocumento: form.tipoDocumento,
      cedula: form.cedula,
      nacionalidad: form.nacionalidad,
      lugarOrigen: form.lugarOrigen,
      ciudadActual: form.ciudadActual,
      direccionActual: form.direccionActual,
      empresaTrabajo: form.empresaTrabajo,
      cargoOcupacion: form.cargoOcupacion,
      tiempoLaborando: form.tiempoLaborando,
      ingresosMensuales: Number(form.ingresosMensuales),
      duracionContrato: form.duracionContrato,
      fechaIngreso: form.fechaIngreso,
      cantidadHabitantes: Number(form.cantidadHabitantes),
      tieneMascotas: form.tieneMascotas || 'No',
      codeudorNombre: form.codeudorNombre,
      codeudorCedula: form.codeudorCedula,
      codeudorTelefono: form.codeudorTelefono,
      codeudorEmpresa: form.codeudorEmpresa,
      codeudorIngresos: Number(form.codeudorIngresos),
      observaciones: form.message || '',
      habitantes: this.habitantesFamilia,
      trabajadores: this.trabajadoresBodega
    };
  }

  proceedToStep2(): void {
    this.isSubmitted = true;
    this.submitErrorMessage = '';

    const fn = this.checkoutFormGroup.get('firstName');
    const ln = this.checkoutFormGroup.get('lastName');
    const ph = this.checkoutFormGroup.get('phone');
    const em = this.checkoutFormGroup.get('email');
    const pw = this.checkoutFormGroup.get('password');
    const cpw = this.checkoutFormGroup.get('confirmPassword');

    if (fn?.invalid || ln?.invalid || ph?.invalid || em?.invalid) {
      fn?.markAsTouched();
      ln?.markAsTouched();
      ph?.markAsTouched();
      em?.markAsTouched();
      return;
    }

    const form = this.checkoutFormGroup.value;
    const passwordIngresada = (form.password || '').trim();
    const confirmPasswordIngresada = (form.confirmPassword || '').trim();

    if (!passwordIngresada && !confirmPasswordIngresada) {
      this.isSubmitted = false;
      this.currentStep = 2;
      this.cdr.detectChanges();
      return;
    }

    if (passwordIngresada !== confirmPasswordIngresada || cpw?.hasError('passwordMismatch')) {
      pw?.markAsTouched();
      cpw?.markAsTouched();
      return;
    }

    this.isSubmittingOrder = true;
    this.cdr.detectChanges();

    const fullName = `${form.firstName || ''} ${form.lastName || ''}`.trim();

    this._authService.register(fullName, form.email, passwordIngresada, form.phone)
      .pipe(
        takeUntil(this.destroy$),
        catchError((err: any) => {
          this.isSubmittingOrder = false;
          this.submitErrorMessage =
            err?.error?.error ||
            err?.error?.message ||
            err?.message ||
            'Error al crear la cuenta.';
          this.cdr.detectChanges();
          return of(null);
        })
      )
      .subscribe((response: any) => {
        this.isSubmittingOrder = false;
        if (!response) return;

        const token = response?.token || response?.jwtToken;
        if (token) {
          localStorage.setItem('token', token);
          localStorage.setItem('jwtToken', token);
        }

        this.hasActiveSession = true;
        this.sessionUser = response?.usuario || response?.user || response;
        this.isSubmitted = false;
        this.currentStep = 2;
        this.cdr.detectChanges();
      });
  }

  placeOrder(): void {
    this.isSubmitted = true;
    this.submitErrorMessage = '';
    this.personasErrorMessage = '';

    if (this.isCartEmpty) {
      this.checkoutFormGroup.markAllAsTouched();
      return;
    }

    if (this.esHabitantesFamilia13_14_15) {
      if (
        this.adultosCount > this.MAX_ADULTOS ||
        this.ninosCount > this.MAX_NINOS ||
        this.habitantesFamilia.length > this.MAX_TOTAL_PERSONAS
      ) {
        this.personasErrorMessage = `Revise los límites: máx. ${this.MAX_ADULTOS} adultos, máx. ${this.MAX_NINOS} niños y máx. ${this.MAX_TOTAL_PERSONAS} integrantes en total.`;
        return;
      }
    }

    this.actualizarConteoPersonas();

    if (this.esBienesRaices) {
      this.isSubmittingOrder = true;
      this.cdr.detectChanges();

      const userObj = this.sessionUser?.usuario || this.sessionUser?.user || this.sessionUser;
      const usuarioId = Number(userObj?.id || userObj?.usuarioId || 0);

      const solicitudes$: Observable<any>[] = this.cartList.map((item: any) => {
        const productoId = this.getProductId(item);
        const payloadArriendo = this.buildInteresadoArriendoPayload(productoId, usuarioId);
        return this._arriendoService.crearArriendo(payloadArriendo);
      });

      forkJoin(solicitudes$)
        .pipe(
          takeUntil(this.destroy$),
          catchError((err: any) => {
            this.isSubmittingOrder = false;
            this.submitErrorMessage =
              err?.error?.error ||
              err?.error?.message ||
              err?.message ||
              'Ocurrió un error al registrar el estudio de arriendo.';
            this.cdr.detectChanges();
            return of(null);
          })
        )
        .subscribe((respuestas: any) => {
          if (!respuestas) return;
          this.isSubmittingOrder = false;

          const registroGuardado = Array.isArray(respuestas) ? respuestas[0] : respuestas;
          const resumenCompleto = {
            ...registroGuardado,
            total: this.totalPrice,
            metodoPago: 'Estudio de Arrendamiento',
            clienteNombre: `${this.checkoutFormGroup.value.firstName || ''} ${this.checkoutFormGroup.value.lastName || ''}`.trim(),
            correo: this.checkoutFormGroup.value.email,
            telefono: this.checkoutFormGroup.value.phone,
            habitantes: this.habitantesFamilia,
            trabajadores: this.trabajadoresBodega
          };

          sessionStorage.setItem('ultima_orden', JSON.stringify(resumenCompleto));

          if ((this._cartService as any).emptyCart) {
            (this._cartService as any).emptyCart();
          }

          this.router.navigate(['/checkout/succuss'], {
            state: { orden: resumenCompleto }
          });
        });

      return;
    }

    const payloadPedido = {
      tipoOperacion: 'COMPRA_PRODUCTO',
      conSesion: this.hasActiveSession,
      clienteNombre: `${this.checkoutFormGroup.value.firstName || ''} ${this.checkoutFormGroup.value.lastName || ''}`.trim(),
      correo: this.checkoutFormGroup.value.email,
      telefono: this.checkoutFormGroup.value.phone,
      datosFormulario: this.checkoutFormGroup.value,
      items: this.cartList,
      total: this.totalPrice,
      metodoPago: 'Pago registrado'
    };

    sessionStorage.setItem('ultima_orden', JSON.stringify(payloadPedido));

    this.router.navigate(['/checkout/succuss'], {
      state: { orden: payloadPedido }
    });
  }
}
