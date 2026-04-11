import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '../../core/services/translate.service';

@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private ts = inject(TranslateService);

  transform(key: string): string {
    return this.ts.t(key);
  }
}
