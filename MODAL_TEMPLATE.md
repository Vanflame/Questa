# Reusable Modal Template

This document provides a complete template for creating consistent, modern modals that can be reused throughout the application.

## Basic Modal Structure

```html
<div class="modal">
    <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
    <div class="modal-container-modern max-w-2xl">
        <!-- Modal Header -->
        <div class="modal-header-modern">
            <div class="modal-title-section">
                <div class="modal-icon">
                    <i class="fas fa-[icon-name]"></i>
                </div>
                <div class="modal-title-content">
                    <h3 class="modal-title">Modal Title</h3>
                    <p class="modal-subtitle">Modal Subtitle</p>
                </div>
            </div>
            <button class="modal-close" onclick="this.closest('.modal').remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>

        <!-- Modal Body -->
        <div class="modal-body-modern">
            <!-- Your content here -->
        </div>

        <!-- Modal Footer -->
        <div class="modal-footer-modern">
            <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                <i class="fas fa-times"></i>
                Cancel
            </button>
            <button type="button" class="btn btn-primary">
                <i class="fas fa-[action-icon]"></i>
                Primary Action
            </button>
        </div>
    </div>
</div>
```

## Modal Container Sizes

- `max-w-2xl` - Medium modal (42rem / 672px)
- `max-w-4xl` - Large modal (56rem / 896px)
- `max-w-lg` - Small modal (32rem / 512px)

## Content Sections Template

### Progress Indicator
```html
<div class="dns-progress-indicator">
    <div class="progress-steps">
        <div class="step active">
            <div class="step-number">1</div>
            <div class="step-label">Step 1</div>
        </div>
        <div class="step-line"></div>
        <div class="step">
            <div class="step-number">2</div>
            <div class="step-label">Step 2</div>
        </div>
        <div class="step-line"></div>
        <div class="step">
            <div class="step-number">3</div>
            <div class="step-label">Step 3</div>
        </div>
    </div>
</div>
```

### Content Section
```html
<div class="dns-section">
    <div class="section-header">
        <div class="section-icon">
            <i class="fas fa-[icon-name]"></i>
        </div>
        <div class="section-title">
            <h4>Section Title</h4>
            <p>Section description</p>
        </div>
    </div>
    
    <div class="instructions-list">
        <!-- Content goes here -->
    </div>
</div>
```

### Instructions List
```html
<div class="instructions-list">
    <div class="instruction-item">
        <div class="instruction-number">1</div>
        <div class="instruction-content">
            <h5>Instruction Title</h5>
            <p>Instruction description</p>
        </div>
    </div>
    <!-- Repeat for more instructions -->
</div>
```

### Important Notice
```html
<div class="important-notice">
    <div class="notice-icon">
        <i class="fas fa-exclamation-triangle"></i>
    </div>
    <div class="notice-content">
        <h5>Important</h5>
        <p>Important message content</p>
    </div>
</div>
```

### Verification Box
```html
<div class="verification-box">
    <div class="dns-server-display">
        <div class="server-label">Label:</div>
        <div class="server-address">
            <span>Value to display</span>
            <button type="button" class="copy-btn" onclick="copyFunction()">
                <i class="fas fa-copy"></i>
            </button>
        </div>
    </div>
    
    <div class="verification-actions">
        <button type="button" class="verify-btn" onclick="verifyFunction()">
            <i class="fas fa-shield-alt"></i>
            Verify Action
        </button>
        <div class="verification-result">
            <!-- Result will appear here -->
        </div>
    </div>
</div>
```

## Button Styles

### Primary Button
```html
<button type="button" class="btn btn-primary">
    <i class="fas fa-[icon]"></i>
    Button Text
</button>
```

### Secondary Button
```html
<button type="button" class="btn btn-secondary">
    <i class="fas fa-[icon]"></i>
    Button Text
</button>
```

### Verify Button (Special)
```html
<button type="button" class="verify-btn">
    <i class="fas fa-[icon]"></i>
    Verify Action
</button>
```

### Copy Button (Small)
```html
<button type="button" class="copy-btn" onclick="copyFunction()">
    <i class="fas fa-copy"></i>
</button>
```

## CSS Classes Reference

### Modal Structure
- `.modal` - Main modal wrapper
- `.modal-overlay` - Background overlay
- `.modal-container-modern` - Modal container
- `.modal-header-modern` - Modal header
- `.modal-body-modern` - Modal body (scrollable)
- `.modal-footer-modern` - Modal footer

### Content Sections
- `.dns-progress-indicator` - Progress indicator container
- `.progress-steps` - Steps container
- `.step` - Individual step
- `.step.active` - Active step
- `.step-number` - Step number circle
- `.step-label` - Step label text
- `.step-line` - Connecting line between steps

- `.dns-section` - Content section card
- `.section-header` - Section header
- `.section-icon` - Section icon
- `.section-title` - Section title area
- `.instructions-list` - Instructions container
- `.instruction-item` - Individual instruction
- `.instruction-number` - Instruction number
- `.instruction-content` - Instruction content

### Special Elements
- `.important-notice` - Important notice box
- `.notice-icon` - Notice icon
- `.notice-content` - Notice content
- `.verification-box` - Verification container
- `.dns-server-display` - Server display box
- `.server-label` - Server label
- `.server-address` - Server address container
- `.verification-actions` - Verification actions
- `.verify-btn` - Verify button
- `.verification-result` - Result display area

### Utility Classes
- `.copy-btn` - Copy button
- `.btn` - Base button
- `.btn-primary` - Primary button
- `.btn-secondary` - Secondary button

## JavaScript Integration

### Creating a Modal
```javascript
const modal = document.createElement('div');
modal.className = 'modal';
modal.innerHTML = `<!-- Modal HTML here -->`;
document.body.appendChild(modal);
```

### Removing a Modal
```javascript
modal.remove();
// or
this.closest('.modal').remove();
```

### Event Listeners
```javascript
// Close on overlay click
modal.querySelector('.modal-overlay').addEventListener('click', () => {
    modal.remove();
});

// Close on close button click
modal.querySelector('.modal-close').addEventListener('click', () => {
    modal.remove();
});
```

## Responsive Design

The modal automatically adapts to different screen sizes:
- Desktop: Full modal with proper spacing
- Tablet: Adjusted padding and sizing
- Mobile: Stacked layout with touch-friendly buttons

## Accessibility Features

- Proper focus management
- Keyboard navigation support
- Screen reader friendly
- High contrast ratios
- Touch-friendly button sizes

## Usage Examples

### Simple Modal
```javascript
function createSimpleModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
        <div class="modal-container-modern max-w-2xl">
            <div class="modal-header-modern">
                <div class="modal-title-section">
                    <div class="modal-icon">
                        <i class="fas fa-info-circle"></i>
                    </div>
                    <div class="modal-title-content">
                        <h3 class="modal-title">${title}</h3>
                    </div>
                </div>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body-modern">
                ${content}
            </div>
            <div class="modal-footer-modern">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                    Close
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
```

### Complex Modal with Progress
```javascript
function createProgressModal(title, subtitle, steps, content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const progressHTML = steps.map((step, index) => `
        <div class="step ${index === 0 ? 'active' : ''}">
            <div class="step-number">${index + 1}</div>
            <div class="step-label">${step}</div>
        </div>
        ${index < steps.length - 1 ? '<div class="step-line"></div>' : ''}
    `).join('');
    
    modal.innerHTML = `
        <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
        <div class="modal-container-modern max-w-2xl">
            <div class="modal-header-modern">
                <div class="modal-title-section">
                    <div class="modal-icon">
                        <i class="fas fa-cog"></i>
                    </div>
                    <div class="modal-title-content">
                        <h3 class="modal-title">${title}</h3>
                        <p class="modal-subtitle">${subtitle}</p>
                    </div>
                </div>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body-modern">
                <div class="dns-progress-indicator">
                    <div class="progress-steps">
                        ${progressHTML}
                    </div>
                </div>
                <div class="dns-content">
                    ${content}
                </div>
            </div>
            <div class="modal-footer-modern">
                <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                    Cancel
                </button>
                <button type="button" class="btn btn-primary">
                    <i class="fas fa-check"></i>
                    Complete
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
```

This template provides everything you need to create consistent, modern modals throughout your application!
