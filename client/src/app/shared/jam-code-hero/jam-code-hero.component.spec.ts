import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';

import { JamCodeHeroComponent } from './jam-code-hero.component';

describe('JamCodeHeroComponent', () => {

  it('renders the Jam code', async () => {
    // Arrange & Act
    await render(JamCodeHeroComponent, {
      componentInputs: { jamCode: 'ABCDEF' },
    });

    // Assert
    expect(screen.getByText('ABCDEF')).toBeTruthy();
  });

  it('shows a Copy Jam code button', async () => {
    // Arrange & Act
    await render(JamCodeHeroComponent, {
      componentInputs: { jamCode: 'ABCDEF' },
    });

    // Assert
    expect(screen.getByRole('button', { name: /copy jam code/i })).toBeTruthy();
  });

  it('changes the copy button label to Copied! after a successful clipboard write', async () => {
    // Arrange
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
    const user = userEvent.setup();
    await render(JamCodeHeroComponent, {
      componentInputs: { jamCode: 'ABCDEF' },
    });

    // Act
    await user.click(screen.getByRole('button', { name: /copy jam code/i }));

    // Assert
    expect(await screen.findByRole('button', { name: /copied!/i })).toBeTruthy();
  });

  it('writes the correct Jam code to the clipboard', async () => {
    // Arrange
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const user = userEvent.setup();
    await render(JamCodeHeroComponent, {
      componentInputs: { jamCode: 'WXPGRT' },
    });

    // Act
    await user.click(screen.getByRole('button', { name: /copy jam code/i }));

    // Assert
    expect(writeText).toHaveBeenCalledWith('WXPGRT');
  });

  it('keeps the Copy Jam code label when the clipboard API throws', async () => {
    // Arrange
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('Permission denied')) },
      configurable: true,
    });
    const user = userEvent.setup();
    await render(JamCodeHeroComponent, {
      componentInputs: { jamCode: 'ABCDEF' },
    });

    // Act
    await user.click(screen.getByRole('button', { name: /copy jam code/i }));

    // Assert — error is swallowed, label unchanged
    expect(screen.getByRole('button', { name: /copy jam code/i })).toBeTruthy();
  });
});

