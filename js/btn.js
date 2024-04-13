const RADIUS = 28;

class Check extends mojs.CustomShape {
  getShape() {
    return '<path transform-origin: 50% 50% 0px; stroke-linecap="square" d="M3.699 9.699l4.193 4.193M19.995 3.652L8.677 14.342"/>';
  }
}
mojs.addShape('check', Check);

var buttons = document.querySelectorAll('.nsfw-btn-container');
buttons.forEach(function(button) {
  button.addEventListener('click', function(e) {
    var rowContainer = this.closest('.nsfw-row');
    
    const circle = new mojs.Shape({
      parent: button,
      left: '50%', top: '50%',
      stroke: '#ffffff',
      strokeWidth: { [2 * RADIUS]: 0 },
      fill: 'none',
      scale: { 0: 1, easing: 'quad.out' },
      radius: RADIUS,
      duration: 450
    });

    const burst = new mojs.Burst({
      parent: button,
      left: '50%', top: '50%',
      radius: { 6: RADIUS - 7 },
      angle: 45,
      children: {
        shape: 'line',
        radius: RADIUS / 7.3,
        scale: 1,
        stroke: '#ffffff',
        strokeDasharray: '100%',
        strokeDashoffset: { '-100%': '100%' },
        degreeShift: 'stagger(0,-5)',
        duration: 700,
        delay: 200,
        easing: 'quad.out',
      }
    });

    const check = new mojs.Shape({
      parent: button.querySelector('.checkmark'),
      left: 52, top: 50,
      shape: 'check',
      stroke: '#ffffff',
      origin: '20% 10%',
      scale: { 0: 1 },
      easing: 'elastic.out',
      duration: 1600,
      delay: 300
    });

    const timeline = new mojs.Timeline({ speed: 1.5 }).add(burst, circle, check);
    const nsfwBtnText = button.querySelector('.nsfw-btn-text');
    if (nsfwBtnText) nsfwBtnText.remove();
    timeline.replay();

    setTimeout(() => {
      button.classList.add('shrink');
      setTimeout(() => {
        button.remove();
        setTimeout(() => {
          rowContainer.classList.add('hover-height');
        }, 0);
      }, 300);
    }, 400);
  });
});


(function() {
  function draggable(selector, options) {
      const elements = document.querySelectorAll(selector);
      let isDragging = false;

      // Apply or restore cursor styles
      function applyCursorStyle(style) {
          document.body.style.cursor = style;
          elements.forEach(el => {
              el.style.cursor = style;
          });
      }

      // Handle the drag start
      function onDragStart(e, el) {
          if (!el) return;
          if (e.target.matches('.modal-close, .modal-close *') || (options.handle && !e.target.matches(options.handle + ', ' + options.handle + ' *'))) {
              return;
          }

          isDragging = true;
          const rect = el.getBoundingClientRect();
          el.setAttribute('data-start-x', e.clientX - rect.left);
          el.setAttribute('data-start-y', e.clientY - rect.top);
          el.style.position = 'absolute'; // Ensure the element is positioned for dragging

          // Apply the 'move' cursor
          applyCursorStyle('move');

          document.addEventListener('mousemove', onDragMove.bind(this, el));
          document.addEventListener('mouseup', onDragEnd.bind(this, el), { once: true });
      }

      // Handle the dragging
      function onDragMove(el, e) {
          if (!isDragging) return;

          let startX = parseInt(el.getAttribute('data-start-x'), 10);
          let startY = parseInt(el.getAttribute('data-start-y'), 10);
          el.style.left = `${e.clientX - startX}px`;
          el.style.top = `${e.clientY - startY}px`;
      }

      // Handle drag end
      function onDragEnd(el) {
          isDragging = false;
          // Restore the default cursor
          applyCursorStyle('');

          el.removeAttribute('data-start-x');
          el.removeAttribute('data-start-y');
          document.removeEventListener('mousemove', onDragMove);
      }

      elements.forEach((el) => {
          el.addEventListener('mousedown', (e) => onDragStart(e, el));
          if (options.handle) {
              const handle = el.querySelector(options.handle);
              if (handle) {
                  handle.style.cursor = 'move'; // Set the cursor on the handle
              }
          } else {
              el.style.cursor = 'move'; // Set the cursor on the draggable element itself
          }
      });
  }

  window.drags = draggable;
})();

drags('#nsfw-modal', {handle: ".nsfw-title"});

function handleEscapeKeyPress(event) {
  if (event.key === "Escape") {
      closeModal();
  }
}

function closeModal() {
  var modal = document.getElementById('nsfw-modal');
  if (modal) { // Check if the modal exists
      modal.classList.add('modal-hide');
      setTimeout(function() {
          modal.remove();
          document.removeEventListener('keydown', handleEscapeKeyPress);
      }, 100);
  }
}

document.addEventListener('keydown', handleEscapeKeyPress);

document.querySelector('.modal-close').addEventListener('click', function() {
closeModal();
});
