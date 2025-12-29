import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `{{ title() }} coming up...`,
})
export class App {
  protected readonly title = signal('yt-guess-who');
}
