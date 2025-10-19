// --- timelineUI.js or inside index.js ---

function makeDraggableList(items, onReorder) {
  const list = document.createElement('ul');
  list.className = 'story-timeline-draggable';

  items.forEach(item => {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.idx = item.idx;
    li.innerHTML = `<strong>${item.storyTime}</strong>: ${item.excerpt.substring(0,50)}...`;
    list.appendChild(li);
  });

  let dragSrcEl = null;

  function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
  }

  function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    this.classList.add('over');
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDragLeave(e) {
    this.classList.remove('over');
  }

  function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    if (dragSrcEl !== this) {
      // swap html
      const tmp = this.innerHTML;
      this.innerHTML = dragSrcEl.innerHTML;
      dragSrcEl.innerHTML = tmp;

      // call reorder callback with new order
      const newOrder = Array.from(list.querySelectorAll('li')).map(li => parseInt(li.dataset.idx,10));
      onReorder(newOrder);
    }
    return false;
  }

  function handleDragEnd(e) {
    list.querySelectorAll('li').forEach(li => {
      li.classList.remove('over');
      li.classList.remove('dragging');
    });
  }

  const lis = list.querySelectorAll('li');
  lis.forEach(li => {
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('dragleave', handleDragLeave);
    li.addEventListener('drop', handleDrop);
    li.addEventListener('dragend', handleDragEnd);
  });

  return list;
}

function showDraggableTimeline() {
  const timeline = buildTimeline();  // use your existing function
  const old = document.getElementById('story-timeline-panel');
  if (old) old.remove();

  const container = document.createElement('div');
  container.id = 'story-timeline-panel';
  container.className = 'story-timeline';

  const title = document.createElement('h3');
  title.textContent = 'Story Timeline (Drag & Drop)';
  container.appendChild(title);

  const list = makeDraggableList(timeline, newOrder => {
    console.log('New order:', newOrder);
    // Here: update your msg.metadata.storyTime or an order field accordingly
    newOrder.forEach((msgIdx, newPosition) => {
      const msg = ctx.chat[msgIdx];
      // e.g., store order as metadata
      if (!msg.metadata) msg.metadata = {};
      msg.metadata.storyOrder = newPosition;
    });
    // Save metadata if API supports it
    ctx.saveMetadata?.();
  });

  container.appendChild(list);
  document.body.appendChild(container);
}
