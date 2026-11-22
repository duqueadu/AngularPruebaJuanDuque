import { Component, OnInit, OnDestroy, ViewChild, HostListener, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, distinctUntilChanged, map, filter, switchMap, take } from 'rxjs/operators';
import { OwlOptions, CarouselComponent } from 'ngx-owl-carousel-o';
import { HotToastService } from '@ngneat/hot-toast';

import { ProductService } from '../services/product.service';
import { CartService } from '../../services/cart.service';
import { WishlistService } from '../../services/wishlist.service';
import { CartItem } from '../../models/cart';
import { WishItem } from '../../models/wishlist';

export interface ProductDetail {
  id: number;
  title: string;
  price: number;
  description: string;
  stock: number;
  images: string[];
  imageTitles: string[];
  category: {
    id: number;
    name: string;
    description: string;
  };
  proveedor?: {
    id: number;
    nombre: string;
    contacto: string;
    email: string;
    telefono: string;
  };
}

export interface SupplierProductSummary {
  id: number;
  title: string;
  price: number;
  image: string;
  categoryName: string;
  stock: number;
}

@Component({
  selector: 'app-product-details',
  templateUrl: './product-details.component.html',
  styleUrls: ['./product-details.component.css']
})
export class ProductDetailsComponent implements OnInit, OnDestroy {
  @ViewChild('myCarousel') myCarousel!: CarouselComponent;

  private destroy$ = new Subject<void>();

  product: ProductDetail | null = null;
  productId!: number;
  relatedSupplierProducts: SupplierProductSummary[] = [];

  cartList: CartItem[] = [];
  wishItems: WishItem[] = [];
  productInCartList: CartItem | undefined;
  isProductInWishList: boolean = false;
  quantity: number = 0;

  backgroundPos: string = 'center center';
  startPosition: number = 0;
  fallbackImage: string = 'assets/images/ImageNotFound.png';
  loremText: string = 'Descripción no disponible para este producto.';

  // Estados del Modal con Zoom
  isModalOpen: boolean = false;
  modalImageIndex: number = 0;
  zoomScale: number = 1;
  zoomOrigin: string = 'center center';

  slider1Settings: OwlOptions = {
    loop: false,
    mouseDrag: false,
    touchDrag: false,
    pullDrag: false,
    dots: false,
    navSpeed: 700,
    nav: false,
    responsive: {
      0: { items: 1 },
      400: { items: 1 },
      740: { items: 1 },
      940: { items: 1 }
    }
  };

  slider2Settings: OwlOptions = {
    loop: false,
    mouseDrag: true,
    touchDrag: true,
    pullDrag: true,
    margin: 10,
    dots: true,
    navSpeed: 700,
    nav: true,
    navText: [
      '<i class="fa-solid fa-arrow-left"></i>',
      '<i class="fa-solid fa-arrow-right"></i>'
    ],
    responsive: {
      0: { items: 3 },
      400: { items: 4 },
      740: { items: 5 },
      940: { items: 6 }
    }
  };

  supplierSliderSettings: OwlOptions = {
    loop: false,
    mouseDrag: true,
    touchDrag: true,
    pullDrag: true,
    margin: 16,
    dots: true,
    navSpeed: 600,
    nav: true,
    navText: [
      '<i class="fa-solid fa-chevron-left"></i>',
      '<i class="fa-solid fa-chevron-right"></i>'
    ],
    responsive: {
      0: { items: 1 },
      576: { items: 2 },
      768: { items: 3 },
      992: { items: 4 }
    }
  };

  constructor(
    private _productService: ProductService,
    private _cartService: CartService,
    private _route: ActivatedRoute,
    private _toast: HotToastService,
    private _wishlistService: WishlistService,
    private _cdr: ChangeDetectorRef
  ) {}

  get esBienesRaices(): boolean {
    const nombreCategoria = this.product?.category?.name?.trim().toLowerCase() || '';
    return nombreCategoria === 'bienes raíces / inmuebles' || this.product?.category?.id === 12;
  }

  ngOnInit(): void {
    this.getCartList();
    this.getWishList();

    this._route.params
      .pipe(
        map(params => Number(params['id'])),
        filter(id => !isNaN(id) && id > 0),
        distinctUntilChanged(),
        switchMap(id => {
          this.productId = id;
          this.relatedSupplierProducts = [];
          return this._productService.getSingleProduct(this.productId).pipe(take(1));
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (data: any[]) => this.mapProductResponse(data),
        error: (err) => {
          console.error('Error al cargar el producto:', err);
          this._toast.error('No se pudo cargar la información del producto', { position: 'top-left' });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.isModalOpen) return;

    if (event.key === 'Escape') {
      this.closeImageModal();
    } else if (event.key === 'ArrowRight') {
      this.nextModalImage();
    } else if (event.key === 'ArrowLeft') {
      this.prevModalImage();
    }
  }

  private mapProductResponse(data: any[]): void {
    if (!data || data.length === 0) return;

    const item = data[0];
    const parsedImages = this.parseStringList(item[4]);

    this.product = {
      id: Number(item[0]),
      title: item[1],
      price: Number(item[2]),
      description: item[3] || this.loremText,
      images: parsedImages.length > 0 ? parsedImages : [this.fallbackImage],
      imageTitles: this.parseStringList(item[5]),
      category: {
        id: Number(item[6]),
        name: item[7] || 'General',
        description: item[8] || ''
      },
      stock: Number(item[10] ?? 0),
      proveedor: item[11] ? {
        id: Number(item[11]),
        nombre: item[12] || '',
        contacto: item[13] || '',
        email: item[14] || '',
        telefono: item[15] || ''
      } : undefined
    };

    this.syncProductStates();

    if (this.product.proveedor?.id) {
      this.loadProductsByProveedor(this.product.proveedor.id);
    }
  }

  private loadProductsByProveedor(proveedorId: number): void {
    this._productService
      .getProductsByProveedor(proveedorId)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (rows: any[]) => {
          if (!Array.isArray(rows) || rows.length === 0) {
            this.relatedSupplierProducts = [];
            return;
          }

          const mapped: SupplierProductSummary[] = rows.map(row => {
            const imgs = this.parseStringList(row[4]);
            return {
              id: Number(row[0]),
              title: row[1],
              price: Number(row[2]),
              image: imgs.length > 0 ? imgs[0] : this.fallbackImage,
              categoryName: row[7] || 'General',
              stock: Number(row[10] ?? 0)
            };
          });

          // Si el proveedor tiene varios productos, excluye el actual; si solo tiene 1, lo muestra
          this.relatedSupplierProducts = mapped.length > 1
            ? mapped.filter(p => p.id !== this.product?.id)
            : mapped;

          this._cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error al cargar productos del proveedor:', err);
          this.relatedSupplierProducts = [];
        }
      });
  }

  private parseStringList(input: unknown): string[] {
    if (typeof input !== 'string' || !input.trim()) return [];
    return input
      .split(',')
      .map(val => val.trim())
      .filter(val => val.length > 0);
  }

  private getCartList(): void {
    this._cartService.cart$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cart => {
        this.cartList = cart?.items || [];
        this.syncProductStates();
      });
  }

  private getWishList(): void {
    this._wishlistService.wishList$
      .pipe(takeUntil(this.destroy$))
      .subscribe(wish => {
        this.wishItems = wish?.items || [];
        this.syncProductStates();
      });
  }

  private syncProductStates(): void {
    if (!this.product) return;

    this.productInCartList = this.cartList.find(item => item.product.id === this.product!.id);
    this.quantity = this.productInCartList?.quantity || 0;
    this.isProductInWishList = this.wishItems.some(item => item.product.id === this.product!.id);
  }

  zoomImage(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;

    const { left, top, width, height } = target.getBoundingClientRect();
    const x = ((event.clientX - left) / width) * 100;
    const y = ((event.clientY - top) / height) * 100;
    this.backgroundPos = `${x}% ${y}%`;
  }

  selectSlide(index: number): void {
    this.startPosition = index;
    if (this.myCarousel) {
      this.myCarousel.to(`main-${index}`);
    }
  }

  nextSlide(event: any): void {
    if (event?.dragging === false && event?.data) {
      this.selectSlide(event.data.startPosition);
    }
  }

  openImageModal(index: number): void {
    this.modalImageIndex = index;
    this.resetZoom();
    this.isModalOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeImageModal(): void {
    this.isModalOpen = false;
    this.resetZoom();
    document.body.style.overflow = 'auto';
  }

  nextModalImage(event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.product) return;
    this.resetZoom();
    this.modalImageIndex = (this.modalImageIndex + 1) % this.product.images.length;
  }

  prevModalImage(event?: Event): void {
    if (event) event.stopPropagation();
    if (!this.product) return;
    this.resetZoom();
    this.modalImageIndex =
      (this.modalImageIndex - 1 + this.product.images.length) % this.product.images.length;
  }

  toggleModalZoom(event: MouseEvent): void {
    event.stopPropagation();
    if (this.zoomScale > 1) {
      this.resetZoom();
    } else {
      this.zoomScale = 2.5;
      this.moveModalZoom(event);
    }
  }

  zoomIn(event: Event): void {
    event.stopPropagation();
    if (this.zoomScale < 4) {
      this.zoomScale = Number((this.zoomScale + 0.5).toFixed(1));
    }
  }

  zoomOut(event: Event): void {
    event.stopPropagation();
    if (this.zoomScale > 1) {
      this.zoomScale = Number((this.zoomScale - 0.5).toFixed(1));
      if (this.zoomScale === 1) this.zoomOrigin = 'center center';
    }
  }

  resetZoom(event?: Event): void {
    if (event) event.stopPropagation();
    this.zoomScale = 1;
    this.zoomOrigin = 'center center';
  }

  moveModalZoom(event: MouseEvent): void {
    if (this.zoomScale <= 1) return;
    const target = event.currentTarget as HTMLElement;
    if (!target) return;

    const { left, top, width, height } = target.getBoundingClientRect();
    const x = ((event.clientX - left) / width) * 100;
    const y = ((event.clientY - top) / height) * 100;
    this.zoomOrigin = `${x}% ${y}%`;
  }

  onModalWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.zoomIn(event);
    } else {
      this.zoomOut(event);
    }
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement && imgElement.src !== this.fallbackImage) {
      imgElement.src = this.fallbackImage;
    }
  }

  updateCartItemQuantity(currentValue: number, product: ProductDetail, operation: '+' | '-'): void {
    const newQuantity = operation === '+' ? currentValue + 1 : currentValue - 1;
    if (newQuantity < 1) return;
    if (product.stock > 0 && newQuantity > product.stock) return;

    this._cartService.setCartItem(
      {
        product: product as any,
        quantity: newQuantity
      },
      true
    );
  }

  addProductToCart(item: ProductDetail): void {
  const bypassStockIds = [12, 13, 14, 15];
  const hasBypassId = bypassStockIds.includes(Number(item.id));

  if (!hasBypassId && item.stock <= 0) {
    this._toast.error('Este producto no tiene stock disponible', { position: 'top-left' });
    return;
  }


    const cartItem: CartItem = {
      product: item as any,
      quantity: 1
    };
    this._cartService.setCartItem(cartItem);
    this._toast.success('Producto agregado al carrito', { position: 'top-left' });
  }

  toggleWishList(item: ProductDetail): void {
    if (this.isProductInWishList) {
      this._wishlistService.deleteWishItem(item.id.toString());
      this._toast.error('Producto eliminado de favoritos', { position: 'top-left' });
    } else {
      const wishItem: WishItem = { product: item as any };
      this._wishlistService.setWishItem(wishItem);
      this._toast.success('Producto guardado en favoritos', { position: 'top-left' });
    }
  }
}
