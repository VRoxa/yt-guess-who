import { Component } from '@angular/core';

import { ConnectionStatusComponent } from './shared/connection-status/connection-status.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ConnectionStatusComponent],
  template: `
    <div class="placeholder">
      Something's coming up soon...
    </div>
    <app-connection-status />
  `,
  styles: [
    `
      .placeholder {
        width: 100%;
        margin: 5rem 0;
        display: flex;
        justify-content: center;
      }
    `,
  ],
})
export class App {}

