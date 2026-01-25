import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <div class="placeholder">
      Something's coming up soon...
    </div>
  `,
  styles: [`
    .placeholder {
      width: 100%;
      margin: 5rem 0;
      display: flex;
      justify-content: center;
    }  
  `]
})
export class App {
}
