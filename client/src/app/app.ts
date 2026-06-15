import { Component } from '@angular/core';

import { LobbyComponent } from './lobby/lobby.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LobbyComponent],
  template: `
    <app-lobby />
  `,
})
export class App {}

