const { useState, useRef, useEffect } = React;

const hexToRgb = (hex) => {
  if (!hex) return null;
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return null;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((value) => Number.isNaN(value))) return null;
  return { r, g, b };
};

const hexToRgba = (hex, alpha) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const MindMapGenerator = () => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [nodes, setNodes] = useState({});
  const [connections, setConnections] = useState([]);
  const [colors, setColors] = useState([]);
  const [title, setTitle] = useState('');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [expandedNodes, setExpandedNodes] = useState({});
  const [hiddenNodes, setHiddenNodes] = useState({});
  const nodesToMoveRef = useRef([]); // Use ref so descendants stay synced during drag frames
  const containerRef = useRef(null);
  const nodesBeingDragged = nodesToMoveRef.current;

  // Parse palette.xml
  useEffect(() => {
    fetch('./palette.xml')
      .then(response => response.text())
      .then(xmlText => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
        const colorNodes = xmlDoc.getElementsByTagName('color');
        const parsedColors = Array.from(colorNodes).map(node => ({
          name: node.getAttribute('name'),
          rgb: '#' + node.getAttribute('rgb')
        }));
        setColors(parsedColors);
      })
      .catch(err => console.error('Error loading palette:', err));
  }, []);

  // Parse OPML file
  useEffect(() => {
    if (colors.length === 0) return;

    fetch('./mindmap.opml', { cache: 'no-store' })
      .then(response => response.text())
      .then(opmlText => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(opmlText, 'text/xml');

        // Get title
        const titleNode = xmlDoc.querySelector('head > title');
        setTitle(titleNode ? titleNode.textContent : 'Mind Map');

        // Get root outline
        const rootOutline = xmlDoc.querySelector('body > outline');
        if (!rootOutline) return;

        const rootText = rootOutline.getAttribute('text');
        const rootNote = rootOutline.getAttribute('_note') || '';

        // Get child outlines
        const childOutlines = Array.from(rootOutline.children);

        // Calculate positions
        const centerPos = { x: 50, y: 50 };
        const positions = { center: centerPos };
        const baseRadius = 24;
        const radius = baseRadius + Math.max(childOutlines.length - 10, 0) * 2; // Scale only when very crowded
        const angleStep = (2 * Math.PI) / childOutlines.length;
        const clampPosition = (value) => Math.max(6, Math.min(94, value));
        const distanceFromParent = (level) => 16 + Math.min(level, 4) * 6;
        const normalizeColor = (value) => {
          if (!value) return null;
          return value.startsWith('#') ? value : `#${value}`;
        };

        // Build nodes object
        const newNodes = {
          center: {
            id: 'center',
            label: rootText,
            x: centerPos.x,
            y: centerPos.y,
            color: '#000000',
            description: rootNote,
            hasChildren: childOutlines.length > 0,
            variant: 'center'
          }
        };

        const newConnections = [];
        let colorIndex = 0; // Track color index across all nodes

        // Process all nodes recursively
        const processNode = (outline, parentId, level, parentAngle, angleRange, nodeColor) => {
          const nodeId = outline.getAttribute('text').toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substr(2, 9);
          const childOutlines = Array.from(outline.children);
          const hasChildren = childOutlines.length > 0;
          const variant = outline.getAttribute('_variant') || 'default';
          const overrideColorAttr = outline.getAttribute('_color');
          const overrideColor = normalizeColor(overrideColorAttr) || (variant === 'alert' ? '#dc2626' : null);
          const effectiveColor = overrideColor || nodeColor || '#042940';

          let x, y;
          if (level === 1) {
            // First level: circle around center
            const angle = parentAngle;
            x = centerPos.x + radius * Math.cos(angle);
            y = centerPos.y + radius * Math.sin(angle);
          } else {
            // Subsequent levels: extend outward from parent
            const parentNode = newNodes[parentId];
            const distance = distanceFromParent(level); // Grow spacing with depth
            // Simply use the provided angle directly for spreading
            x = parentNode.x + distance * Math.cos(parentAngle);
            y = parentNode.y + distance * Math.sin(parentAngle);
          }

          const clampedX = clampPosition(x);
          const clampedY = clampPosition(y);
          positions[nodeId] = { x: clampedX, y: clampedY };

          // Keep children data for popup display
          const children = Array.from(outline.children).map(child => ({
            label: child.getAttribute('text'),
            detail: child.getAttribute('_note') || ''
          }));

          newNodes[nodeId] = {
            id: nodeId,
            label: outline.getAttribute('text'),
            x: clampedX,
            y: clampedY,
            color: effectiveColor,
            description: outline.getAttribute('_note') || '',
            children: children.length > 0 ? children : undefined,
            parentId,
            level,
            hasChildren,
            variant
          };

          newConnections.push({ from: parentId, to: nodeId });

          // Process children as actual nodes (for future multi-level support)
          if (hasChildren) {
            // Increase angular spread - multiply angleRange by 1.5 to give more room
            const spreadMultiplier = 1.6 + Math.min(childOutlines.length - 1, 4) * 0.25;
            const effectiveRange = Math.min(Math.PI * 1.15, angleRange * spreadMultiplier);
            const childAngleStep = effectiveRange / childOutlines.length;
            const startAngle = parentAngle - effectiveRange / 2;

            childOutlines.forEach((childOutline, idx) => {
              const childAngle = startAngle + childAngleStep * (idx + 0.5);
              // Give children more angular space to spread out, inherit parent color
              processNode(childOutline, nodeId, level + 1, childAngle, childAngleStep, effectiveColor);
            });
          }
        };

        childOutlines.forEach((outline, index) => {
          const angle = index * angleStep - Math.PI / 2;
          // Give first level children full angular space to avoid overlap
          // Each first-level node gets its own color from the palette
          const branchColor = colors[index % colors.length]?.rgb || '#042940';
          processNode(outline, 'center', 1, angle, angleStep, branchColor);
        });

        setNodePositions(positions);
        setNodes(newNodes);
        setConnections(newConnections);
      })
      .catch(err => console.error('Error loading OPML:', err));
  }, [colors]);

  useEffect(() => {
    let detach = () => {};
    const attachWheelHandler = () => {
      const container = containerRef.current;
      if (!container) return false;
      const handleWheelEvent = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prev => Math.max(0.1, Math.min(5, prev * delta)));
      };
      container.addEventListener('wheel', handleWheelEvent, { passive: false });
      detach = () => container.removeEventListener('wheel', handleWheelEvent);
      return true;
    };

    if (attachWheelHandler()) {
      return () => detach();
    }

    let rafId = requestAnimationFrame(function retryAttach() {
      if (!attachWheelHandler()) {
        rafId = requestAnimationFrame(retryAttach);
      }
    });

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      detach();
    };
  }, []);

  const handleMouseDown = (e, nodeId) => {
    e.preventDefault();

    // Calculate which nodes to move and store in state
    const getAllDescendants = (id, nodesObj) => {
      const descendants = [];
      const findChildren = (parentId) => {
        Object.keys(nodesObj).forEach(childId => {
          if (nodesObj[childId].parentId === parentId) {
            descendants.push(childId);
            findChildren(childId);
          }
        });
      };
      findChildren(id);
      return descendants;
    };

    const allNodesToMove = [nodeId, ...getAllDescendants(nodeId, nodes)];
    nodesToMoveRef.current = allNodesToMove;

    setDraggingNode(nodeId);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragOffset({ x: 0, y: 0 });
    setHasDragged(false);
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      setPan(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!draggingNode || !containerRef.current) return;

    setHasDragged(true);

    const container = containerRef.current.getBoundingClientRect();
    const offsetX = ((e.clientX - dragStart.x) / container.width) * 100;
    const offsetY = ((e.clientY - dragStart.y) / container.height) * 100;

    // Just update the offset state - this will trigger immediate re-render
    setDragOffset({ x: offsetX, y: offsetY });
  };

  const handleMouseUp = () => {
    if (draggingNode) {
      const nodesToUpdate = nodesToMoveRef.current;
      // Apply the final offset to the actual node positions
      setNodes(prev => {
        const newNodes = { ...prev };
        nodesToUpdate.forEach(nodeId => {
          if (newNodes[nodeId]) {
            newNodes[nodeId] = {
              ...newNodes[nodeId],
              x: Math.max(5, Math.min(95, (prev[nodeId].x || 0) + dragOffset.x)),
              y: Math.max(5, Math.min(95, (prev[nodeId].y || 0) + dragOffset.y))
            };
          }
        });
        return newNodes;
      });
    }

    setDragOffset({ x: 0, y: 0 });
    setDraggingNode(null);
    nodesToMoveRef.current = []; // Clear the nodes to move
    setIsPanning(false);
  };

  const handleCanvasMouseDown = (e) => {
    if (e.target === e.currentTarget || e.target.tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleNodeClick = (nodeId, e) => {
    if (!hasDragged) {
      // Option/Alt + Click to toggle node expansion or hide leaf nodes
      if (e.altKey) {
        if (nodes[nodeId]?.hasChildren) {
          // Toggle expansion for nodes with children
          setExpandedNodes(prev => ({
            ...prev,
            [nodeId]: !prev[nodeId]
          }));
        } else {
          // Toggle visibility for leaf nodes
          setHiddenNodes(prev => ({
            ...prev,
            [nodeId]: !prev[nodeId]
          }));
        }
      } else {
        setSelectedNode(selectedNode === nodeId ? null : nodeId);
      }
    }
  };

  const toggleNodeExpansion = (nodeId, e) => {
    e.stopPropagation();
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const isNodeVisible = (node) => {
    if (node.id === 'center') return true;
    if (hiddenNodes[node.id]) return false; // Node is explicitly hidden
    if (!node.parentId) return false; // First level nodes need parent expanded

    // Check if all ancestors are expanded
    let currentNode = node;
    while (currentNode.parentId) {
      if (!expandedNodes[currentNode.parentId]) return false;
      currentNode = nodes[currentNode.parentId];
      if (!currentNode) break;
    }
    return true;
  };

  const hasHiddenChildren = (nodeId) => {
    // Check if any direct children are hidden
    return Object.keys(nodes).some(id =>
      nodes[id].parentId === nodeId && hiddenNodes[id]
    );
  };

  const unhideAllChildren = (nodeId, e) => {
    e.stopPropagation();
    // Unhide all direct children of this node
    const childIds = Object.keys(nodes).filter(id => nodes[id].parentId === nodeId);
    setHiddenNodes(prev => {
      const newHidden = { ...prev };
      childIds.forEach(id => {
        delete newHidden[id];
      });
      return newHidden;
    });
  };

  const isLightColor = (color) => {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 155;
  };

  if (Object.keys(nodes).length === 0) {
    return (
      <div className="loading-state">
        <p className="loading-state__text">Loading mind map...</p>
      </div>
    );
  }

  return (
    <div
      className="mindmap-root"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ cursor: isPanning ? 'grabbing' : 'default' }}
    >
      <div
        className="canvas-container"
        ref={containerRef}
        onMouseDown={handleCanvasMouseDown}
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      >
          <div
            className="stage"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isPanning || draggingNode ? 'none' : 'transform 0.1s ease-out'
            }}
          >
            <svg className="connection-layer">
              {Object.values(nodes).map((node) => {
                if (!node.parentId || !isNodeVisible(node)) return null;
                const parentNode = nodes[node.parentId];
                if (!parentNode) return null;

                // Apply drag offset if this node is being dragged
                const isBeingDragged = draggingNode && nodesBeingDragged.includes(node.id);
                const parentBeingDragged = draggingNode && nodesBeingDragged.includes(node.parentId);

                // Apply offset to get the visual position
                const nodeX = node.x + (isBeingDragged ? dragOffset.x : 0);
                const nodeY = node.y + (isBeingDragged ? dragOffset.y : 0);
                const parentX = parentNode.x + (parentBeingDragged ? dragOffset.x : 0);
                const parentY = parentNode.y + (parentBeingDragged ? dragOffset.y : 0);

                return (
                  <line
                    key={`line-${node.id}`}
                    x1={`${parentX}%`}
                    y1={`${parentY}%`}
                    x2={`${nodeX}%`}
                    y2={`${nodeY}%`}
                    stroke={colors[1]?.rgb || '#9FC131'}
                    strokeWidth="2"
                    opacity="0.4"
                  />
                );
              })}
            </svg>

            {Object.values(nodes).filter(isNodeVisible).map((node) => {
              // Apply drag offset if this node is being dragged
              const isBeingDragged = draggingNode && nodesBeingDragged.includes(node.id);
              const x = node.x + (isBeingDragged ? dragOffset.x : 0);
              const y = node.y + (isBeingDragged ? dragOffset.y : 0);
              const isBottomHalf = y > 50;
              const isRightHalf = x > 50;

              const wrapperClass = `node-wrapper ${isBeingDragged ? 'node-wrapper--dragging' : 'node-wrapper--static'}`;
              const bubbleScale = selectedNode === node.id ? 1.15 : hoveredNode === node.id ? 1.1 : 1;
              const isCenterNode = node.id === 'center';
              const isAlertNode = node.variant === 'alert';
              const isFilledNode = isCenterNode || isAlertNode;
              const bubbleClass = [
                'node-bubble',
                isCenterNode ? 'node-bubble--center' : '',
                isAlertNode ? 'node-bubble--alert' : '',
                selectedNode === node.id ? 'node-bubble--selected' : '',
                hoveredNode === node.id && selectedNode !== node.id ? 'node-bubble--hovered' : ''
              ].filter(Boolean).join(' ');
              let bubbleShadow = selectedNode === node.id
                ? `0 0 0 4px ${node.color}55, 0 24px 45px rgba(15, 23, 42, 0.22)`
                : hoveredNode === node.id
                  ? '0 20px 40px rgba(15, 23, 42, 0.18)'
                  : '0 12px 30px rgba(15, 23, 42, 0.15)';

              if (isAlertNode) {
                bubbleShadow = selectedNode === node.id
                  ? `0 0 0 4px ${node.color}55, 0 28px 50px rgba(220, 38, 38, 0.45)`
                  : hoveredNode === node.id
                    ? '0 24px 45px rgba(220, 38, 38, 0.35)'
                    : '0 16px 35px rgba(220, 38, 38, 0.25)';
              }

              const bubbleStyles = {
                backgroundColor: isFilledNode ? node.color : '#ffffff',
                color: isFilledNode ? '#ffffff' : node.color,
                border: isFilledNode ? 'none' : `3px solid ${node.color}`,
                fontSize: isCenterNode ? '1.25rem' : '0.95rem',
                fontWeight: isFilledNode ? '700' : '600',
                transform: `scale(${bubbleScale})`,
                boxShadow: bubbleShadow,
                ...(selectedNode === node.id && { '--selection-color': node.color })
              };
              const availabilityPrefix = 'availability:';
              let availabilityText = null;
              let secondaryDescription = null;
              if (node.description) {
                const trimmedDescription = node.description.trim();
                if (trimmedDescription.toLowerCase().startsWith(availabilityPrefix)) {
                  availabilityText = trimmedDescription.slice(availabilityPrefix.length).trim();
                } else {
                  secondaryDescription = trimmedDescription;
                }
              }
              const availabilityBackground = hexToRgba(node.color, isAlertNode ? 0.16 : 0.12) || 'rgba(15, 23, 42, 0.08)';
              const availabilityBorderColor = hexToRgba(node.color, isAlertNode ? 0.45 : 0.25) || 'rgba(15, 23, 42, 0.15)';
              const availabilityLabelColor = node.color || '#0f172a';
              const availabilityTextColor = isAlertNode ? '#7f1d1d' : '#0f172a';
              const childrenDividerColor = hexToRgba(node.color, isAlertNode ? 0.4 : 0.2) || node.color || '#e5e7eb';
              const childEntryBackground = hexToRgba(node.color, isAlertNode ? 0.18 : 0.1) || 'rgba(148, 163, 184, 0.12)';
              const childDetailColor = isAlertNode ? '#7f1d1d' : '#374151';

              return (
                <div
                  key={node.id}
                  className={wrapperClass}
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    zIndex: selectedNode === node.id ? 20 : hoveredNode === node.id ? 15 : 10,
                    userSelect: 'none'
                  }}
                  onClick={(e) => handleNodeClick(node.id, e)}
                  onMouseDown={(e) => handleMouseDown(e, node.id)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <div className="node-inner">
                    <div
                      className={bubbleClass}
                      style={bubbleStyles}
                    >
                      {node.label}
                    </div>

                    {node.hasChildren && hoveredNode === node.id && (
                      <>
                        <div
                          className="node-action node-action--toggle"
                          style={{
                            backgroundColor: node.color,
                            color: isFilledNode ? '#ffffff' : (isLightColor(node.color) ? '#000000' : '#ffffff'),
                          }}
                          onClick={(e) => toggleNodeExpansion(node.id, e)}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <span>
                            {expandedNodes[node.id] ? '−' : '+'}
                          </span>
                        </div>
                        {expandedNodes[node.id] && hasHiddenChildren(node.id) && (
                          <div
                            className="node-action node-action--reset"
                            style={{
                              backgroundColor: node.color,
                              color: isFilledNode ? '#ffffff' : (isLightColor(node.color) ? '#000000' : '#ffffff'),
                            }}
                            onClick={(e) => unhideAllChildren(node.id, e)}
                            onMouseDown={(e) => e.stopPropagation()}
                            title="Reset: Show all hidden children"
                          >
                            <span>↻</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {selectedNode === node.id && (
                    <div
                      className={`node-popover ${isBottomHalf ? 'node-popover--bottom' : 'node-popover--top'} ${isRightHalf ? 'node-popover--right' : 'node-popover--left'}`}
                    >
                      <h3 className="node-popover__title" style={{ color: node.color }}>{node.label}</h3>
                      {availabilityText && (
                        <div
                          className="node-popover__availability"
                          style={{
                            backgroundColor: availabilityBackground,
                            borderColor: availabilityBorderColor,
                            color: availabilityTextColor
                          }}
                        >
                          <span
                            className="node-popover__availability-label"
                            style={{ color: availabilityLabelColor }}
                          >
                            Availability
                          </span>
                          <p className="node-popover__availability-text">{availabilityText}</p>
                        </div>
                      )}

                      {secondaryDescription && (
                        <p className="node-popover__description">{secondaryDescription}</p>
                      )}

                      {node.children && (
                        <div className="node-popover__children" style={{ borderTop: `2px solid ${childrenDividerColor}` }}>
                          {node.children.map((child, i) => (
                            <div
                              key={i}
                              className="child-entry"
                              style={{
                                borderLeft: `4px solid ${childrenDividerColor}`,
                                backgroundColor: childEntryBackground,
                                boxShadow: '0 12px 24px rgba(15, 23, 42, 0.08)'
                              }}
                            >
                              <span className="child-entry__title" style={{ color: node.color }}>{child.label}</span>
                              <span className="child-entry__detail" style={{ color: childDetailColor }}>{child.detail}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<MindMapGenerator />);
