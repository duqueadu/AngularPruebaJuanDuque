import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-checkout-complete',
  templateUrl: './checkout-complete.component.html',
  styleUrls: ['./checkout-complete.component.css']
})
export class CheckoutCompleteComponent implements OnInit, OnDestroy {

  orden: any = null;
  totalPrice: number = 0;
  today: number = Date.now();
  mostrarDetalle: boolean = true;
  private cartSub?: Subscription;

  constructor(
    private router: Router,
    private _cartService: CartService,
  ) {
    const navState = this.router.getCurrentNavigation()?.extras?.state;
    if (navState?.['orden']) {
      this.orden = navState['orden'];
    }
  }

  ngOnInit(): void {
    if (!this.orden) {
      const stateOrden = history.state?.orden;
      if (stateOrden) {
        this.orden = stateOrden;
      } else {
        const guardada = sessionStorage.getItem('ultima_orden');
        if (guardada) {
          try {
            this.orden = JSON.parse(guardada);
          } catch {
            this.orden = null;
          }
        }
      }
    }

    const totalDesdeOrden =
      this.orden?.total ??
      this.orden?.montoTotal ??
      this.orden?.valorTotal ??
      this.orden?.totalPagar;

    if (totalDesdeOrden != null) {
      this.totalPrice = Number(totalDesdeOrden);
    } else {
      this.getTotalPrice();
    }
  }

  get numeroOrden(): string {
    return String(
      this.orden?.numeroOrden ??
      this.orden?.codigo ??
      this.orden?.referencia ??
      this.orden?.id ??
      '—'
    );
  }

  get fechaOrden(): any {
    return (
      this.orden?.fechaRegistro ??
      this.orden?.fechaCreacion ??
      this.orden?.fecha ??
      this.today
    );
  }

  get metodoPagoTexto(): string {
    return (
      this.orden?.metodoPago ??
      this.orden?.medioPago ??
      this.orden?.formaPago ??
      'No especificado'
    );
  }

  get estadoTexto(): string {
    return this.orden?.estado ?? 'CONFIRMADO';
  }

  toggleDetalle(): void {
    this.mostrarDetalle = !this.mostrarDetalle;
  }

  getTotalPrice(): void {
    this.cartSub = this._cartService.cart$.subscribe((cart) => {
      this.totalPrice = 0;
      if (cart?.items) {
        cart.items.forEach((item) => {
          this.totalPrice += (item.product.price ?? 0) * (item.quantity ?? 0);
        });
      }
    });
  }

  navigateToStore(): void {
    sessionStorage.removeItem('ultima_orden');
    this.router.navigate(['/']);
  }

  ngOnDestroy(): void {
    this.cartSub?.unsubscribe();
  }
}
