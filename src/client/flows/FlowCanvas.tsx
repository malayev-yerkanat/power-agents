import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap, applyNodeChanges, applyEdgeChanges,
  type Connection, type Edge, type ReactFlowInstance } from '@xyflow/react';
import { FlowCard } from './FlowCard';
import { FlowInspector } from './FlowInspector';
import { compatiblePorts, nodeLabels, patchNodes, toCanvas, type CanvasNode } from './helpers';
import { useFlow, type Request } from './useFlow';

const nodeTypes = { flowCard: FlowCard };
const ariaLabels = { 'controls.ariaLabel': 'Управление канвасом', 'handle.ariaLabel': 'Порт узла',
  'node.a11yDescription.keyboardDisabled': 'Выберите узел. Delete удаляет выбранное.',
  'node.a11yDescription.ariaLiveMessage': ({ x, y }: { direction: string; x: number; y: number }) => `Узел перемещён: ${Math.round(x)}, ${Math.round(y)}`,
  'controls.zoomIn.ariaLabel': 'Приблизить', 'controls.zoomOut.ariaLabel': 'Отдалить',
  'controls.fitView.ariaLabel': 'Показать весь поток', 'controls.interactive.ariaLabel': 'Переключить взаимодействие',
  'minimap.ariaLabel': 'Миникарта потока', 'node.a11yDescription.default': 'Выберите узел. Delete удаляет выбранное.',
  'edge.a11yDescription.default': 'Выберите связь. Delete удаляет выбранное.' };

export function FlowCanvas({ id, request, csrfToken, back }: { id: string; request: Request; csrfToken: string; back: () => void }) {
  const { flow, types, error, setError, pending, patch, action, refetch } = useFlow(id, request, csrfToken);
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [menu, setMenu] = useState(false);
  const instance = useRef<ReactFlowInstance<CanvasNode, Edge> | null>(null);
  const positions = useRef<Record<string, { x: number; y: number }>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rejectDialog = useRef<HTMLDialogElement>(null);
  const act = useCallback((nodeId: string, kind: 'run' | 'approve' | 'reject') => {
    if (kind === 'reject') { setRejectId(nodeId); setNote(''); }
    else void action(nodeId, kind);
  }, [action]);
  useEffect(() => { if (flow) document.getElementById('workspace-heading')?.focus(); }, [flow?.id]);
  const mapped = useMemo(() => flow ? toCanvas(flow, types) : null, [flow, types]);
  useEffect(() => {
    if (!mapped) return;
    setNodes(current => mapped.nodes.map(node => {
      const previous = current.find(n => n.id === node.id);
      // Keep React Flow's measured size: without it the node is hidden until its size changes again.
      return { ...node, position: positions.current[node.id] || node.position, selected: previous?.selected,
        ...(previous?.measured ? { measured: previous.measured } : {}), data: { ...node.data, pending, action: act } };
    }));
    setEdges(current => mapped.edges.map(edge => ({ ...edge, selected: current.find(e => e.id === edge.id)?.selected })));
  }, [mapped, pending, act]);
  useEffect(() => { if (rejectId) rejectDialog.current?.showModal(); else rejectDialog.current?.close(); }, [rejectId]);
  const savePositions = useCallback(() => {
    const batch = positions.current;
    if (!Object.keys(batch).length) return;
    void patch(latest => ({ nodes: patchNodes(latest).map(n => batch[n.id] ? { ...n, position: batch[n.id] } : n) })).then(() => {
      positions.current = Object.fromEntries(Object.entries(positions.current).filter(([nodeId, pos]) => pos !== batch[nodeId]));
      // Reconcile even when a conflict rejected this batch.
      setNodes(current => current.map(n => ({ ...n, position: positions.current[n.id] || n.data.node.position })));
    });
  }, [patch]);
  const schedulePositions = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveTimer.current = undefined; savePositions(); }, 350);
  }, [savePositions]);
  useEffect(() => () => { if (saveTimer.current) { clearTimeout(saveTimer.current); savePositions(); } }, [savePositions]);
  const validConnection = useCallback((connection: Connection | Edge) => {
    if (!flow || connection.source === connection.target) return false;
    const source = flow.nodes.find(n => n.id === connection.source), target = flow.nodes.find(n => n.id === connection.target);
    const output = types.find(t => t.type === source?.type)?.outputs.find(p => p.name === connection.sourceHandle);
    const input = types.find(t => t.type === target?.type)?.inputs.find(p => p.name === connection.targetHandle);
    return compatiblePorts(output?.type, input?.type);
  }, [flow, types]);
  function connect(connection: Connection) {
    if (!validConnection(connection) || !connection.sourceHandle || !connection.targetHandle) {
      setError('Типы портов несовместимы. Текстовый вход принимает любой тип.'); return;
    }
    const edge = { id: crypto.randomUUID(), from: { node: connection.source, port: connection.sourceHandle },
      to: { node: connection.target, port: connection.targetHandle } };
    void patch(latest => ({ edges: [...latest.edges, edge] }));
  }
  function addNode(type: string) {
    const definition = types.find(t => t.type === type);
    if (!definition) return;
    setMenu(false);
    const viewport = instance.current?.getViewport();
    const position = viewport ? { x: (80 - viewport.x) / viewport.zoom, y: (80 - viewport.y) / viewport.zoom } : { x: 0, y: 0 };
    void patch(latest => ({ nodes: [...patchNodes(latest), { id: crypto.randomUUID(), type,
      title: nodeLabels[type] || definition.title, position, config: structuredClone(definition.configDefaults), gate: definition.gate }] }));
  }
  const selectedNode = flow?.nodes.find(n => n.id === selected);
  const definition = types.find(t => t.type === selectedNode?.type);
  return <main className="flow-workspace">
    {error && <div className="flow-toast" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Закрыть сообщение">×</button></div>}
    {!flow ? <div className="flows-list"><h1 id="workspace-heading" tabIndex={-1}>Поток</h1><p>{error ? 'Поток не загружен.' : 'Загружаем поток…'}</p>
      <button onClick={() => void refetch().catch(cause => setError(String(cause)))}>Повторить</button><button onClick={back}>К потокам</button></div>
      : <><div className="flow-toolbar"><button onClick={back}>← Потоки</button><h1 id="workspace-heading" tabIndex={-1}>{flow.title}</h1>
          <span className={`flow-mode flow-mode-${flow.mode}`}>{flow.mode === 'demo' ? 'Демо' : 'Живой · исполнители запланированы'}</span>
          <label className="flow-checkbox"><input type="checkbox" checked={flow.autoRun} disabled={pending}
            onChange={e => { const autoRun = e.target.checked; void patch(() => ({ autoRun })); }} />Автозапуск</label>
          <div className="flow-add"><button onClick={() => setMenu(value => !value)} aria-expanded={menu} disabled={!types.length || pending}>+ Узел</button>
            {menu && <div className="flow-add-menu">{types.map(type => <button key={type.type} onClick={() => addNode(type.type)}>{nodeLabels[type.type] || type.title}</button>)}</div>}
          </div></div>
        <div className="flow-body"><div className="flow-graph" aria-label="Канвас потока">
          {types.length > 0 && <ReactFlow<CanvasNode, Edge> nodes={nodes} edges={edges} nodeTypes={nodeTypes}
            onInit={value => { instance.current = value; }} fitView fitViewOptions={{ padding: 0.15 }} minZoom={0.15} maxZoom={2}
            colorMode="dark" ariaLabelConfig={ariaLabels} deleteKeyCode={['Delete', 'Backspace']}
            onNodesChange={changes => {
              for (const change of changes) if (change.type === 'position' && change.position)
                positions.current = { ...positions.current, [change.id]: change.position };
              setNodes(current => applyNodeChanges(changes, current));
              if (changes.some(change => change.type === 'position' && change.dragging === false)) schedulePositions();
            }}
            onEdgesChange={changes => setEdges(current => applyEdgeChanges(changes, current))}
            onNodeDragStop={schedulePositions}
            onNodeClick={(_, node) => setSelected(node.id)} onPaneClick={() => { setSelected(null); setMenu(false); }}
            onBeforeDelete={async elements => {
              const nodeIds = new Set(elements.nodes.map(n => n.id)), edgeIds = new Set(elements.edges.map(e => e.id));
              await patch(latest => ({ nodes: patchNodes(latest).filter(n => !nodeIds.has(n.id)),
                edges: latest.edges.filter(e => !edgeIds.has(e.id) && !nodeIds.has(e.from.node) && !nodeIds.has(e.to.node)) }));
              return false;
            }}
            isValidConnection={validConnection} onConnect={connect}
            onConnectEnd={(_, state) => { if (state.toHandle && !state.isValid) setError('Соединение недопустимо. Проверьте типы портов; текстовый вход принимает любой тип.'); }}
            defaultEdgeOptions={{ type: 'default', style: { stroke: '#697381', strokeWidth: 1.2 }, interactionWidth: 18 }}>
            <Background variant={BackgroundVariant.Dots} color="#353a43" bgColor="#0c0e12" gap={20} size={1} />
            <Controls /><MiniMap<CanvasNode> nodeColor={node => node.data.node.status === 'approved' ? '#438d65' : '#485363'} pannable zoomable />
          </ReactFlow>}
        </div>
        {selectedNode && definition && <FlowInspector key={JSON.stringify([selectedNode.id, selectedNode.title, selectedNode.gate, selectedNode.config])} node={selectedNode} definition={definition}
          pending={pending} close={() => setSelected(null)} save={value => patch(latest => ({ nodes: patchNodes(latest).map(n => n.id === selectedNode.id ? { ...n, ...value } : n) }))} />}
        </div></>}
    <dialog ref={rejectDialog} className="flow-reject" onCancel={() => setRejectId(null)} aria-labelledby="flow-reject-title">
      <form onSubmit={async e => { e.preventDefault(); if (rejectId && await action(rejectId, 'reject', note)) setRejectId(null); }}>
        <h2 id="flow-reject-title">Отклонить результат</h2><label>Замечание<textarea autoFocus required maxLength={12000} rows={4} value={note} onChange={e => setNote(e.target.value)} /></label>
        <p>Узел запустится повторно с вашим замечанием.</p><button disabled={pending || !note.trim()} type="submit">Отклонить и повторить</button>
        <button type="button" onClick={() => setRejectId(null)}>Отмена</button>
      </form>
    </dialog>
  </main>;
}
