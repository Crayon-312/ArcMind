import { Brain, Check, ChevronDown, FileText, Mic, MicOff, Pencil, Plus, Send, Settings, Square, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  AiStreamEvent,
  ChatMessage,
  ConversationState,
  ConversationSummary,
  CoreMode,
  LongTermMemory,
  ModelConfig,
  PublicModelConfig,
  PublicRealtimeVoiceConfig,
  RealtimeVoiceCapabilityResult,
  RealtimeVoiceConfig,
  RuntimeInfo
} from '../../../shared'
import { deriveCoreMode } from '../../../shared'
import { useMicrophoneLevel } from '../audio/useMicrophoneLevel'
import { ParticleCore } from '../visual/ParticleCore'
import { resolveVisualSignal } from '../visual/signal'
import { canUseSpeechSynthesis, createUtterance, shouldAutoSpeak } from '../voice/speech'
import { desktopBridgeUnavailableMessage, hasModelSettingsBridge } from './runtimeBridge'
import { coreModeLabel, statusText } from './statusText'
import { SystemTelemetryProjection } from './SystemTelemetryProjection'
import { revealNextChunk, TYPEWRITER_FRAME_MS } from './typewriter'
import { createOpenWorkbenchDocument, parseWorkbenchContent, stripWorkbenchMarkup, type WorkbenchDocument } from './workbench'

const seedMessages: ChatMessage[] = [
  {
    id: 'assistant-seed',
    role: 'assistant',
    content: 'ArcMind 已就绪。粒子核心会根据麦克风输入呼吸，后续可接入大模型流式对话。',
    createdAt: new Date(0).toISOString()
  }
]

const fallbackConversation: ConversationState = {
  id: 'local-fallback',
  title: '新的会话',
  messages: seedMessages,
  status: 'idle',
  activeRequestId: null,
  updatedAt: new Date(0).toISOString()
}

interface TypewriterState {
  requestId: string | null
  target: string
  visible: string
  finalMessage: ChatMessage | null
  done: boolean
  frameId: number
  timerId: number
}

export function App(): JSX.Element {
  const microphone = useMicrophoneLevel()
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [conversationId, setConversationId] = useState(fallbackConversation.id)
  const [conversationTitle, setConversationTitle] = useState(fallbackConversation.title)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>(seedMessages)
  const [draft, setDraft] = useState('')
  const [muted, setMuted] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [conversationStatus, setConversationStatus] = useState<ConversationState['status']>('idle')
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [version, setVersion] = useState('0.1.0')
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelConfig, setModelConfig] = useState<PublicModelConfig | null>(null)
  const [settingsDraft, setSettingsDraft] = useState<Partial<ModelConfig>>({})
  const [realtimeVoiceConfig, setRealtimeVoiceConfig] = useState<PublicRealtimeVoiceConfig | null>(null)
  const [realtimeVoiceDraft, setRealtimeVoiceDraft] = useState<Partial<RealtimeVoiceConfig>>({})
  const [realtimeVoiceCapability, setRealtimeVoiceCapability] = useState<RealtimeVoiceCapabilityResult | null>(null)
  const [testingRealtimeVoice, setTestingRealtimeVoice] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [memories, setMemories] = useState<LongTermMemory[]>([])
  const [memoryDraft, setMemoryDraft] = useState('')
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null)
  const [tokenPulse, setTokenPulse] = useState(0)
  const [errorPulse, setErrorPulse] = useState(0)
  const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false)
  const [toolRailOpen, setToolRailOpen] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [workbenchOpen, setWorkbenchOpen] = useState(false)
  const [workbenchDocument, setWorkbenchDocument] = useState<WorkbenchDocument>(() => parseWorkbenchContent(''))
  const lastVisualTokenPulseAtRef = useRef(0)
  const activeRequestIdRef = useRef<string | null>(null)
  const streamUnsubscribeRef = useRef<(() => void) | null>(null)
  const typewriterRef = useRef<TypewriterState>(createIdleTypewriterState())
  const composerPanelRef = useRef<HTMLElement | null>(null)
  const composerZoneRef = useRef<HTMLDivElement | null>(null)
  const composerPointerInsideRef = useRef(false)
  const composerFocusInsideRef = useRef(false)
  const composerOpenStateRef = useRef(composerOpen)
  const draftRef = useRef(draft)
  const recordingStatusRef = useRef(recordingStatus)

  useEffect(() => {
    void window.arcMind?.getAppVersion().then(setVersion).catch(() => setVersion('0.1.0'))
    void window.arcMind?.getRuntimeInfo?.().then(setRuntimeInfo).catch(() => setRuntimeInfo(null))
    void window.arcMind?.settings.getModelConfig().then((config) => {
      setModelConfig(config)
      setSettingsDraft(config)
    })
    void loadRealtimeVoiceSettings()
    void loadInitialConversation()
    void refreshMemories()
  }, [])

  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  useEffect(() => {
    composerOpenStateRef.current = composerOpen
  }, [composerOpen])

  useEffect(() => {
    recordingStatusRef.current = recordingStatus
  }, [recordingStatus])

  const loadInitialConversation = async (): Promise<void> => {
    const conversation = await window.arcMind?.storage.getMostRecentConversation()
    if (conversation) {
      applyConversation(conversation)
      await refreshConversationList()
    }
  }

  const mode: CoreMode = useMemo(() => {
    return deriveCoreMode({
      conversationStatus,
      microphoneStatus: microphone.status,
      muted,
      lastMessage: messages[messages.length - 1],
      transcribing: recordingStatus === 'transcribing',
      speaking
    })
  }, [conversationStatus, messages, microphone.status, muted, recordingStatus, speaking])

  const visualSignal = useMemo(
    () =>
      resolveVisualSignal({
        mode,
        audio: microphone.signal,
        tokenPulse,
        errorPulse
      }),
    [errorPulse, microphone.signal, mode, tokenPulse]
  )

  const hudSummary = useMemo(() => {
    const persistedMessages = messages.filter((message) => message.id !== 'assistant-seed')
    const enabledMemories = memories.filter((memory) => memory.enabled).length

    return {
      model: modelConfig?.model || '未配置',
      modelReady: Boolean(modelConfig?.hasApiKey && modelConfig.model),
      messageCount: persistedMessages.length,
      enabledMemories,
      totalMemories: memories.length,
      tokenPulse
    }
  }, [memories, messages, modelConfig, tokenPulse])

  const latestAssistantMessage = useMemo(() => {
    return [...messages].reverse().find((message) => message.role === 'assistant' && message.content.trim().length > 0)
  }, [messages])

  const activeAssistantMessage = useMemo(() => {
    return activeRequestId ? messages.find((message) => message.id === activeRequestId && message.role === 'assistant') ?? null : null
  }, [activeRequestId, messages])

  const workbenchMessage = activeAssistantMessage ?? latestAssistantMessage
  const workbenchMarkdown = workbenchDocument.markdown || (workbenchMessage?.content ? stripWorkbenchMarkup(workbenchMessage.content) : '')
  const composerVisible = composerOpen || recordingStatus !== 'idle'

  const submit = (): void => {
    const value = draft.trim()
    if (!value || conversationStatus === 'streaming') {
      return
    }

    const chat = window.arcMind?.chat
    if (!chat) {
      setError(desktopBridgeUnavailableMessage)
      return
    }

    cancelActiveRequest()
    setDraft('')
    composerOpenStateRef.current = false
    setComposerOpen(false)
    setConversationStatus('streaming')
    setError(null)
    setTokenPulse(0)
    lastVisualTokenPulseAtRef.current = 0
    setSettingsOpen(false)
    setMemoryOpen(false)
    setWorkbenchDocument(createOpenWorkbenchDocument('', '回应生成中'))
    setWorkbenchOpen(true)
    const requestId = crypto.randomUUID()
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: value,
      createdAt: new Date().toISOString()
    }
    const assistantMessage: ChatMessage = {
      id: requestId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString()
    }

    const currentMessages = messages.filter((message) => message.id !== 'assistant-seed')
    const nextMessages = [...currentMessages, userMessage, assistantMessage]
    setMessages(nextMessages)
    setActiveRequestId(requestId)
    activeRequestIdRef.current = requestId
    startTypewriterReveal(requestId)

    const unsubscribe = chat.onStream(requestId, (event) => {
      handleStreamEvent(event, requestId)
    })
    streamUnsubscribeRef.current = unsubscribe

    void chat
      .sendMessage({ requestId, conversationId, messages: nextMessages.filter((message) => message.id !== requestId) })
      .catch((unknownError) => {
        if (activeRequestIdRef.current !== requestId) {
          return
        }
        resetTypewriterReveal()
        releaseStream(requestId)
        setMessages((current) => current.filter((message) => message.id !== requestId))
        setConversationStatus('error')
        setActiveRequestId(null)
        setWorkbenchOpen(false)
        setWorkbenchDocument(parseWorkbenchContent(''))
        setError(errorMessage(unknownError))
        setErrorPulse((value) => value + 1)
      })
  }

  const handleStreamEvent = (event: AiStreamEvent, expectedRequestId: string): void => {
    if (event.requestId !== expectedRequestId || activeRequestIdRef.current !== expectedRequestId) {
      return
    }

    if (event.type === 'token') {
      appendTypewriterTarget(event.requestId, event.delta)
      pulseTokenVisual()
      return
    }

    if (event.type === 'done') {
      completeTypewriterReveal(event.requestId, event.message)
      return
    }

    if (event.type === 'cancelled') {
      resetTypewriterReveal()
      releaseStream(event.requestId)
      setConversationStatus('cancelled')
      setActiveRequestId(null)
      return
    }

    if (event.type === 'error') {
      resetTypewriterReveal()
      releaseStream(event.requestId)
      setMessages((current) => current.filter((message) => message.id !== event.requestId))
      setConversationStatus('error')
      setActiveRequestId(null)
      setWorkbenchOpen(false)
      setWorkbenchDocument(parseWorkbenchContent(''))
      setError(event.error.message)
      setErrorPulse((value) => value + 1)
    }
  }

  const cancel = (): void => {
    cancelActiveRequest(true)
  }

  const releaseStream = (requestId?: string): void => {
    if (requestId && activeRequestIdRef.current !== requestId) {
      return
    }
    streamUnsubscribeRef.current?.()
    streamUnsubscribeRef.current = null
    activeRequestIdRef.current = null
  }

  const cancelActiveRequest = (markCancelled = false): void => {
    const requestId = activeRequestIdRef.current
    if (requestId) {
      void window.arcMind?.chat.cancel(requestId)
    }
    resetTypewriterReveal()
    releaseStream(requestId ?? undefined)
    setActiveRequestId(null)
    if (markCancelled) {
      setConversationStatus('cancelled')
    }
  }

  const startTypewriterReveal = (requestId: string): void => {
    resetTypewriterReveal()
    typewriterRef.current = {
      requestId,
      target: '',
      visible: '',
      finalMessage: null,
      done: false,
      frameId: 0,
      timerId: 0
    }
  }

  const appendTypewriterTarget = (requestId: string, delta: string): void => {
    const typewriter = typewriterRef.current
    if (typewriter.requestId !== requestId) {
      return
    }

    typewriter.target += delta
    scheduleTypewriterFrame()
  }

  const completeTypewriterReveal = (requestId: string, message: ChatMessage): void => {
    const typewriter = typewriterRef.current
    if (typewriter.requestId !== requestId) {
      return
    }

    typewriter.target = message.content
    typewriter.finalMessage = message
    typewriter.done = true
    scheduleTypewriterFrame()
  }

  const resetTypewriterReveal = (): void => {
    const typewriter = typewriterRef.current
    if (typewriter.frameId) {
      cancelAnimationFrame(typewriter.frameId)
    }
    if (typewriter.timerId) {
      window.clearTimeout(typewriter.timerId)
    }
    typewriterRef.current = createIdleTypewriterState()
  }

  const scheduleTypewriterFrame = (): void => {
    const typewriter = typewriterRef.current
    if (!typewriter.requestId || typewriter.frameId || typewriter.timerId) {
      return
    }

    typewriter.timerId = window.setTimeout(runTypewriterFrame, TYPEWRITER_FRAME_MS)
  }

  const runTypewriterFrame = (): void => {
    const typewriter = typewriterRef.current
    const requestId = typewriter.requestId
    typewriter.frameId = 0
    typewriter.timerId = 0

    if (!requestId) {
      return
    }

    const nextVisible = revealNextChunk(typewriter.visible, typewriter.target)
    if (nextVisible !== typewriter.visible) {
      typewriter.visible = nextVisible
      setMessages((current) => current.map((message) => (message.id === requestId ? { ...message, content: nextVisible } : message)))
    }

    if (typewriter.visible.length < typewriter.target.length) {
      scheduleTypewriterFrame()
      return
    }

    if (typewriter.done && typewriter.finalMessage) {
      const finalMessage = typewriter.finalMessage
      typewriterRef.current = createIdleTypewriterState()
      releaseStream(requestId)
      setMessages((current) => current.map((message) => (message.id === requestId ? finalMessage : message)))
      setConversationStatus('idle')
      setActiveRequestId(null)
      setWorkbenchDocument(createOpenWorkbenchDocument(finalMessage.content))
      setWorkbenchOpen(true)
      speakAssistantMessage(finalMessage.content)
      void refreshConversationList()
    }
  }

  const pulseTokenVisual = (): void => {
    const now = Date.now()
    if (now - lastVisualTokenPulseAtRef.current < 140) {
      return
    }
    lastVisualTokenPulseAtRef.current = now
    setTokenPulse((value) => value + 1)
  }

  const revealComposer = (): void => {
    if (composerOpenStateRef.current) {
      return
    }
    composerOpenStateRef.current = true
    setComposerOpen(true)
  }

  const collapseComposer = (): void => {
    composerPointerInsideRef.current = false
    composerFocusInsideRef.current = false
    composerOpenStateRef.current = false
    setComposerOpen(false)
  }

  const maybeCollapseEmptyComposer = (): void => {
    if (draftRef.current.trim().length > 0 || recordingStatusRef.current !== 'idle' || composerFocusInsideRef.current) {
      return
    }
    composerOpenStateRef.current = false
    setComposerOpen(false)
  }

  const targetInsideComposer = (target: EventTarget | null): boolean => {
    if (!(target instanceof Node)) {
      return false
    }

    return Boolean(composerPanelRef.current?.contains(target) || composerZoneRef.current?.contains(target))
  }

  const handleComposerPointerEnter = (): void => {
    composerPointerInsideRef.current = true
    revealComposer()
  }

  const handleComposerPointerLeave = (target: EventTarget | null): void => {
    if (targetInsideComposer(target)) {
      return
    }
    composerPointerInsideRef.current = false
    maybeCollapseEmptyComposer()
  }

  const handleComposerMouseEnter = (): void => {
    composerPointerInsideRef.current = true
    revealComposer()
  }

  const handleComposerMouseLeave = (target: EventTarget | null): void => {
    if (targetInsideComposer(target)) {
      return
    }
    composerPointerInsideRef.current = false
    maybeCollapseEmptyComposer()
  }

  const handleComposerFocus = (): void => {
    composerFocusInsideRef.current = true
    revealComposer()
  }

  const handleComposerBlur = (target: EventTarget | null): void => {
    if (targetInsideComposer(target)) {
      return
    }
    composerFocusInsideRef.current = false
    maybeCollapseEmptyComposer()
  }

  useEffect(() => {
    const handleDocumentMove = (event: PointerEvent | MouseEvent): void => {
      if (targetInsideComposer(event.target)) {
        composerPointerInsideRef.current = true
        revealComposer()
        return
      }

      if (!composerOpenStateRef.current) {
        return
      }
      composerPointerInsideRef.current = false
      maybeCollapseEmptyComposer()
    }

    document.addEventListener('pointermove', handleDocumentMove)
    document.addEventListener('mousemove', handleDocumentMove)
    return () => {
      document.removeEventListener('pointermove', handleDocumentMove)
      document.removeEventListener('mousemove', handleDocumentMove)
    }
  }, [])

  useEffect(() => {
    return () => {
      const requestId = activeRequestIdRef.current
      if (requestId) {
        void window.arcMind?.chat.cancel(requestId)
      }
      resetTypewriterReveal()
      releaseStream(requestId ?? undefined)
    }
  }, [])

  const speakAssistantMessage = (text: string): void => {
    if (!shouldAutoSpeak(muted, text)) {
      return
    }

    void window.arcMind?.voice.speak({ text })
    if (!canUseSpeechSynthesis()) {
      setError('当前运行环境不支持语音播报。')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = createUtterance(
      text,
      () => setSpeaking(false),
      (message) => {
        setSpeaking(false)
        setError(message)
      }
    )
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const stopSpeaking = (): void => {
    void window.arcMind?.voice.stopSpeaking()
    if (canUseSpeechSynthesis()) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
  }

  const saveSettings = async (): Promise<void> => {
    const bridge = window.arcMind
    if (!hasModelSettingsBridge(bridge)) {
      setError(desktopBridgeUnavailableMessage)
      return
    }

    const next = await bridge.settings.setModelConfig(withoutBlankApiKey(settingsDraft))
    if (next) {
      setModelConfig(next)
      setSettingsDraft(next)
      setError(null)
    }
  }

  const loadRealtimeVoiceSettings = async (): Promise<void> => {
    const bridge = window.arcMind
    if (!hasModelSettingsBridge(bridge)) {
      return
    }

    try {
      const config = await bridge.settings.getRealtimeVoiceConfig()
      setRealtimeVoiceConfig(config)
      setRealtimeVoiceDraft(config)

      if (!config.baseUrl || !config.hasApiKey) {
        return
      }

      setTestingRealtimeVoice(true)
      const capability = await bridge.settings.testRealtimeVoiceConfig()
      setRealtimeVoiceCapability(capability)
      if (!capability.ok) {
        setRealtimeVoiceDraft((current) => ({ ...current, enabled: false }))
      }

      if (config.enabled && (capability.status === 'unsupported' || capability.status === 'auth_failed')) {
        const disabled = await bridge.settings.setRealtimeVoiceConfig({ enabled: false })
        setRealtimeVoiceConfig(disabled)
        setRealtimeVoiceDraft(disabled)
      }
    } catch {
      setRealtimeVoiceCapability({
        ok: false,
        status: 'network_failed',
        message: '实时语音自动检测失败，请检查 codex-LB 服务。',
        checkedAt: new Date().toISOString()
      })
      setRealtimeVoiceDraft((current) => ({ ...current, enabled: false }))
    } finally {
      setTestingRealtimeVoice(false)
    }
  }

  const updateRealtimeVoiceDraft = (patch: Partial<RealtimeVoiceConfig>): void => {
    setRealtimeVoiceDraft((current) => ({ ...current, ...patch, enabled: false }))
    setRealtimeVoiceCapability(null)
  }

  const testRealtimeVoiceSettings = async (): Promise<void> => {
    const bridge = window.arcMind
    if (!hasModelSettingsBridge(bridge)) {
      setError(desktopBridgeUnavailableMessage)
      return
    }

    setTestingRealtimeVoice(true)
    try {
      const capability = await bridge.settings.testRealtimeVoiceConfig(withoutBlankRealtimeVoiceApiKey(realtimeVoiceDraft))
      setRealtimeVoiceCapability(capability)
      if (!capability.ok) {
        setRealtimeVoiceDraft((current) => ({ ...current, enabled: false }))
      }
      setError(null)
    } catch (unknownError) {
      setRealtimeVoiceCapability({
        ok: false,
        status: 'network_failed',
        message: errorMessage(unknownError),
        checkedAt: new Date().toISOString()
      })
      setRealtimeVoiceDraft((current) => ({ ...current, enabled: false }))
    } finally {
      setTestingRealtimeVoice(false)
    }
  }

  const saveRealtimeVoiceSettings = async (): Promise<void> => {
    const bridge = window.arcMind
    if (!hasModelSettingsBridge(bridge)) {
      setError(desktopBridgeUnavailableMessage)
      return
    }
    if (realtimeVoiceDraft.enabled && realtimeVoiceCapability?.status !== 'available') {
      setError('必须先通过 codex-LB 实时语音能力检测，才能启用该功能。')
      return
    }

    try {
      const next = await bridge.settings.setRealtimeVoiceConfig(
        withoutBlankRealtimeVoiceApiKey(realtimeVoiceDraft)
      )
      setRealtimeVoiceConfig(next)
      setRealtimeVoiceDraft(next)
      setError(null)
    } catch (unknownError) {
      setError(errorMessage(unknownError))
      setRealtimeVoiceDraft((current) => ({ ...current, enabled: false }))
    }
  }

  const createConversation = async (): Promise<void> => {
    cancelActiveRequest()
    const conversation = await window.arcMind?.storage.createConversation('新的会话')
    if (conversation) {
      applyConversation(conversation)
      await refreshConversationList()
    }
  }

  const openConversation = async (id: string): Promise<void> => {
    cancelActiveRequest()
    const conversation = await window.arcMind?.storage.getConversation(id)
    if (conversation) {
      applyConversation(conversation)
    }
  }

  const deleteCurrentConversation = async (): Promise<void> => {
    cancelActiveRequest()
    if (!conversationId || conversationId === fallbackConversation.id) {
      return
    }
    await window.arcMind?.storage.deleteConversation(conversationId)
    const conversation = await window.arcMind?.storage.getMostRecentConversation()
    if (conversation) {
      applyConversation(conversation)
    }
    await refreshConversationList()
  }

  const clearCurrentConversation = async (): Promise<void> => {
    cancelActiveRequest()
    const conversation = await window.arcMind?.storage.clearConversation(conversationId)
    if (conversation) {
      applyConversation(conversation)
      await refreshConversationList()
    }
  }

  const refreshConversationList = async (): Promise<void> => {
    const summaries = await window.arcMind?.storage.listConversations()
    if (summaries) {
      setConversations(summaries)
    }
  }

  const refreshMemories = async (): Promise<void> => {
    const items = await window.arcMind?.storage.listMemories()
    if (items) {
      setMemories(items)
    }
  }

  const saveMemory = async (): Promise<void> => {
    const content = memoryDraft.trim()
    if (!content) {
      setError('记忆内容不能为空。')
      return
    }

    try {
      if (editingMemoryId) {
        await window.arcMind?.storage.updateMemory({ id: editingMemoryId, content })
      } else {
        await window.arcMind?.storage.createMemory({ content })
      }

      setMemoryDraft('')
      setEditingMemoryId(null)
      setError(null)
      await refreshMemories()
    } catch (unknownError) {
      setError(errorMessage(unknownError) || '记忆保存失败。')
    }
  }

  const editMemory = (memory: LongTermMemory): void => {
    setEditingMemoryId(memory.id)
    setMemoryDraft(memory.content)
  }

  const cancelMemoryEdit = (): void => {
    setEditingMemoryId(null)
    setMemoryDraft('')
  }

  const toggleMemory = async (memory: LongTermMemory): Promise<void> => {
    try {
      await window.arcMind?.storage.setMemoryEnabled({ id: memory.id, enabled: !memory.enabled })
      await refreshMemories()
    } catch (unknownError) {
      setError(errorMessage(unknownError) || '记忆状态更新失败。')
    }
  }

  const deleteMemory = async (memory: LongTermMemory): Promise<void> => {
    try {
      await window.arcMind?.storage.deleteMemory(memory.id)
      if (editingMemoryId === memory.id) {
        cancelMemoryEdit()
      }
      await refreshMemories()
    } catch (unknownError) {
      setError(errorMessage(unknownError) || '记忆删除失败。')
    }
  }

  const applyConversation = (conversation: ConversationState): void => {
    cancelActiveRequest()
    stopSpeaking()
    setConversationId(conversation.id)
    setConversationTitle(conversation.title)
    setMessages(conversation.messages.length > 0 ? conversation.messages : seedMessages)
    setConversationStatus(conversation.status === 'streaming' ? 'idle' : conversation.status)
    setActiveRequestId(null)
    setError(null)
  }

  const testSettings = async (): Promise<void> => {
    const bridge = window.arcMind
    if (!hasModelSettingsBridge(bridge)) {
      setError(desktopBridgeUnavailableMessage)
      return
    }

    const result = await bridge.settings.testModelConfig(withoutBlankApiKey(settingsDraft))
    setError(result?.ok ? '模型配置可用。' : result?.error?.message ?? '模型配置不可用。')
  }

  const toggleMic = async (): Promise<void> => {
    if (recordingStatus === 'recording') {
      mediaRecorder?.stop()
      return
    }

    if (recordingStatus === 'transcribing') {
      return
    }

    let stream: MediaStream | null = null
    try {
      setError(null)
      setRecordingStatus('recording')
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      await microphone.start(stream)
      const recordingStream = stream
      const chunks: BlobPart[] = []
      const recorder = new MediaRecorder(recordingStream)

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      })

      recorder.addEventListener('stop', () => {
        recordingStream.getTracks().forEach((track) => track.stop())
        microphone.stop()
        setMediaRecorder(null)
        void transcribeChunks(chunks, recorder.mimeType || 'audio/webm')
      })

      setMediaRecorder(recorder)
      recorder.start()
    } catch (unknownError) {
      stream?.getTracks().forEach((track) => track.stop())
      microphone.stop()
      setRecordingStatus('idle')
      setError(errorMessage(unknownError) || '麦克风不可用。')
      setErrorPulse((value) => value + 1)
    }
  }

  const transcribeChunks = async (chunks: BlobPart[], mimeType: string): Promise<void> => {
    try {
      setRecordingStatus('transcribing')
      const blob = new Blob(chunks, { type: mimeType })
      const result = await window.arcMind?.voice.transcribe({
        audio: await blob.arrayBuffer(),
        mimeType,
        fileName: mimeType.includes('webm') ? 'speech.webm' : 'speech.audio'
      })

      if (result?.text) {
        setDraft((current) => (current ? `${current} ${result.text}` : result.text))
        revealComposer()
      }
      setRecordingStatus('idle')
    } catch (unknownError) {
      setRecordingStatus('idle')
      setError(errorMessage(unknownError) || '语音识别失败。')
      setErrorPulse((value) => value + 1)
    }
  }

  return (
    <main
      className={`app-shell ${conversationDrawerOpen ? 'is-conversation-drawer-open' : ''} ${toolRailOpen ? 'is-tool-rail-open' : ''} ${workbenchOpen ? 'is-workbench-open' : ''} ${composerVisible ? 'is-composer-open' : ''}`}
    >
      <ParticleCore mode={mode} signal={visualSignal} sidebarOpen={conversationDrawerOpen} workbenchOpen={workbenchOpen || settingsOpen || memoryOpen} composerOpen={composerVisible} />

      <div className="ambient-grid" />
      <section className="command-surface" aria-label="ArcMind conversation">
        <div className="window-drag-region" aria-hidden="true" />

        <header className="brand-anchor">
          <img className="brand-anchor-icon" src="./icon.png" alt="" aria-hidden="true" />
          <h1>ArcMind</h1>
          <span className={`status-dot status-${mode}`} />
        </header>

        <div
          className="conversation-drawer-zone"
          onPointerEnter={() => setConversationDrawerOpen(true)}
          onPointerLeave={() => setConversationDrawerOpen(false)}
          onFocus={() => setConversationDrawerOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setConversationDrawerOpen(false)
            }
          }}
        >
          <button
            className="corner-hotspot corner-hotspot-left"
            type="button"
            title="会话列表"
            aria-label="会话列表"
            onClick={() => setConversationDrawerOpen((value) => !value)}
          />
          <aside className={`conversation-list ${conversationDrawerOpen ? 'is-open' : ''}`} aria-label="会话历史">
            <div className="conversation-list-header">
              <span>会话</span>
              <button className="mini-button" type="button" title="新建会话" onClick={() => void createConversation()}>
                <Plus size={14} />
              </button>
            </div>
            <div className="conversation-items">
              {conversations.map((conversation) => (
                <button
                  className={`conversation-item ${conversation.id === conversationId ? 'is-current' : ''}`}
                  key={conversation.id}
                  type="button"
                  onClick={() => void openConversation(conversation.id)}
                >
                  <span>{conversation.title}</span>
                  <small>{conversation.messageCount} 条</small>
                </button>
              ))}
            </div>
            <div className="conversation-tools">
              <button className="mini-button" type="button" title="清空当前会话" onClick={() => void clearCurrentConversation()}>
                清空
              </button>
              <button className="mini-button" type="button" title="删除当前会话" onClick={() => void deleteCurrentConversation()}>
                <Trash2 size={14} />
              </button>
            </div>
          </aside>
        </div>

        <div
          className="tool-rail-zone"
          onPointerEnter={() => setToolRailOpen(true)}
          onPointerLeave={() => setToolRailOpen(false)}
          onFocus={() => setToolRailOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setToolRailOpen(false)
            }
          }}
        >
          <button className="corner-hotspot corner-hotspot-right" type="button" title="工具" aria-label="工具" onClick={() => setToolRailOpen((value) => !value)} />
          <aside className={`tool-rail ${toolRailOpen ? 'is-open' : ''}`} aria-label="隐式工具">
            <button
              className="tool-icon-button is-status"
              type="button"
              title={`回应 ${conversationStatus === 'streaming' ? '生成中' : statusText(mode, microphone.status)}`}
              onClick={() => {
                if (latestAssistantMessage) {
                  const nextWorkbenchDocument = parseWorkbenchContent(latestAssistantMessage.content)
                  setWorkbenchDocument(nextWorkbenchDocument.shouldOpen ? nextWorkbenchDocument : { ...nextWorkbenchDocument, shouldOpen: true, kind: 'long-answer' })
                }
                setWorkbenchOpen((value) => !value)
                setSettingsOpen(false)
                setMemoryOpen(false)
              }}
            >
              <FileText size={16} />
              <span className={`status-dot status-${mode}`} />
            </button>
            <button
              className="tool-icon-button"
              type="button"
              title={`记忆 ${hudSummary.enabledMemories}/${hudSummary.totalMemories}`}
              onClick={() => {
                setMemoryOpen((value) => !value)
                setSettingsOpen(false)
                setWorkbenchOpen(false)
              }}
            >
              <Brain size={16} />
            </button>
            <button
              className="tool-icon-button"
              type="button"
              title="设置"
              onClick={() => {
                setSettingsOpen((value) => !value)
                setMemoryOpen(false)
                setWorkbenchOpen(false)
              }}
            >
              <Settings size={16} />
            </button>
            <button
              className="tool-icon-button"
              type="button"
              title={speaking ? '停止播报' : muted ? '开启播报' : '关闭播报'}
              onClick={() => {
                if (speaking) {
                  stopSpeaking()
                  return
                }
                setMuted((value) => {
                  const next = !value
                  if (next) {
                    stopSpeaking()
                  }
                  return next
                })
              }}
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </aside>
        </div>

        <section className="hero-stage" aria-label="ArcMind core status">
          <div className="core-readout">
            <span>弦核模式</span>
            <strong>{coreModeLabel(mode)}</strong>
          </div>
        </section>

        <SystemTelemetryProjection hidden={workbenchOpen || settingsOpen || memoryOpen} />

        <section className={`workbench-panel ${workbenchOpen ? 'is-open' : ''}`} aria-label="工作台" aria-hidden={!workbenchOpen}>
          <div className="workbench-header">
            <div>
              <span>Workbench</span>
              <strong>{workbenchDocument.title}</strong>
            </div>
            <button className="icon-button" type="button" title="关闭工作台" onClick={() => setWorkbenchOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="markdown-body">
            {workbenchMarkdown ? renderMarkdown(workbenchMarkdown) : conversationStatus === 'streaming' ? <p className="streaming-placeholder">正在生成回应...</p> : null}
          </div>
          {workbenchDocument.choices.length > 0 ? (
            <div className="choice-list">
              {workbenchDocument.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => {
                    setDraft(choice.value)
                    revealComposer()
                    setWorkbenchOpen(false)
                  }}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <div
          className="composer-zone"
          ref={composerZoneRef}
          onPointerEnter={handleComposerPointerEnter}
          onPointerMove={handleComposerPointerEnter}
          onPointerLeave={(event) => handleComposerPointerLeave(event.relatedTarget)}
          onMouseEnter={handleComposerMouseEnter}
          onMouseMove={handleComposerMouseEnter}
          onMouseLeave={(event) => handleComposerMouseLeave(event.relatedTarget)}
          onFocus={handleComposerFocus}
          onBlur={(event) => handleComposerBlur(event.relatedTarget)}
        >
          <button className="composer-handle" type="button" title="输入" onClick={revealComposer}>
            <span />
          </button>
        </div>

        <div className={`composer-impact ${composerVisible ? 'is-active' : ''}`} aria-hidden="true">
          <span className="impact-edge" />
          <span className="impact-spark impact-spark-a" />
          <span className="impact-spark impact-spark-b" />
          <span className="impact-spark impact-spark-c" />
        </div>

        <div className={`composer-source-ripple ${composerVisible ? 'is-active' : ''}`} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <footer
          className={`composer ${composerVisible ? 'is-open' : ''}`}
          ref={composerPanelRef}
          onPointerEnter={handleComposerPointerEnter}
          onPointerMove={handleComposerPointerEnter}
          onPointerLeave={(event) => handleComposerPointerLeave(event.relatedTarget)}
          onMouseEnter={handleComposerMouseEnter}
          onMouseMove={handleComposerMouseEnter}
          onMouseLeave={(event) => handleComposerMouseLeave(event.relatedTarget)}
          onFocus={handleComposerFocus}
          onBlur={(event) => handleComposerBlur(event.relatedTarget)}
        >
          <button className="composer-collapse-button" type="button" title="收起输入框" aria-label="收起输入框" onClick={collapseComposer}>
            <ChevronDown size={16} />
          </button>
          <button
            className={`round-button ${microphone.status === 'listening' ? 'is-active' : ''}`}
            type="button"
            title={recordingStatus === 'recording' ? '停止录音' : recordingStatus === 'transcribing' ? '正在转写' : '点击说话'}
            onClick={() => void toggleMic()}
          >
            {recordingStatus === 'recording' ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <input
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              revealComposer()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                submit()
              }
            }}
            placeholder={recordingStatus === 'transcribing' ? '正在转写语音...' : '输入一句话，先让弧核亮起来...'}
            aria-label="输入消息"
          />
          <button
            className="icon-button send-button"
            type="button"
            title={conversationStatus === 'streaming' ? '停止' : '发送'}
            onClick={conversationStatus === 'streaming' ? cancel : submit}
          >
            {conversationStatus === 'streaming' ? <Square size={16} /> : <Send size={18} />}
          </button>
        </footer>

        {settingsOpen ? (
          <section className="settings-panel" aria-label="模型与实时语音设置">
            <div className="panel-heading">
              <span>模型与语音</span>
              <small>本机配置</small>
            </div>

            <div className="settings-section">
              <div className="settings-section-heading">
                <span>文字模型</span>
                <small>OpenAI-compatible（兼容 OpenAI 请求格式）</small>
              </div>
              <label>
                服务地址（Base URL）
                <input
                  value={settingsDraft.baseUrl ?? ''}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, baseUrl: event.target.value }))}
                />
              </label>
              <label>
                模型名称（Model）
                <input
                  value={settingsDraft.model ?? ''}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, model: event.target.value }))}
                />
              </label>
              <label>
                接口密钥（API Key）
                <input
                  type="password"
                  placeholder={modelConfig?.hasApiKey ? '已配置，留空表示不修改' : '输入 API Key'}
                  onChange={(event) => setSettingsDraft((current) => ({ ...current, apiKey: event.target.value }))}
                />
              </label>
              <div className="settings-grid">
                <label>
                  温度（Temperature）
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settingsDraft.temperature ?? 0.7}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({ ...current, temperature: Number(event.target.value) }))
                    }
                  />
                </label>
                <label>
                  上下文条数（Context）
                  <input
                    type="number"
                    min="1"
                    max="40"
                    value={settingsDraft.maxContextMessages ?? 12}
                    onChange={(event) =>
                      setSettingsDraft((current) => ({
                        ...current,
                        maxContextMessages: Number(event.target.value)
                      }))
                    }
                  />
                </label>
              </div>
              <div className="settings-actions">
                <button type="button" onClick={() => void saveSettings()}>
                  保存文字模型
                </button>
                <button type="button" onClick={() => void testSettings()}>
                  测试文字连接
                </button>
              </div>
            </div>

            <div className="settings-section settings-section-live">
              <div className="settings-section-heading">
                <span>GPT-Live 实时语音</span>
                <small className="provider-badge">仅限 codex-LB</small>
              </div>
              <p className="settings-notice">
                此功能使用 codex-LB 的私有 Codex Live Voice（Codex 实时语音）兼容接口，不是通用模型能力。
                其他服务即使兼容文字接口，也不能开启实时语音。
              </p>
              <label>
                codex-LB 服务根地址
                <input
                  value={realtimeVoiceDraft.baseUrl ?? ''}
                  placeholder="例如：https://your-codex-lb.example.com"
                  onChange={(event) => updateRealtimeVoiceDraft({ baseUrl: event.target.value })}
                />
              </label>
              <label>
                codex-LB 代理接口密钥（API Key）
                <input
                  type="password"
                  placeholder={realtimeVoiceConfig?.hasApiKey ? '已配置，留空表示不修改' : '输入已注册的代理 API Key'}
                  onChange={(event) => updateRealtimeVoiceDraft({ apiKey: event.target.value })}
                />
              </label>
              <div
                className={`voice-capability is-${testingRealtimeVoice ? 'checking' : realtimeVoiceCapability?.status ?? 'idle'}`}
                role="status"
              >
                {testingRealtimeVoice
                  ? '正在检测 codex-LB 实时语音能力……'
                  : realtimeVoiceCapability?.message ?? '修改地址或密钥后，需要重新检测。'}
              </div>
              <label className="voice-enable-row">
                <input
                  type="checkbox"
                  checked={Boolean(realtimeVoiceDraft.enabled)}
                  disabled={testingRealtimeVoice || realtimeVoiceCapability?.status !== 'available'}
                  onChange={(event) =>
                    setRealtimeVoiceDraft((current) => ({ ...current, enabled: event.target.checked }))
                  }
                />
                <span>
                  启用 GPT-Live 实时语音
                  <small>保存时主进程会再次检测，不能绕过此门禁。</small>
                </span>
              </label>
              <div className="settings-actions">
                <button
                  type="button"
                  disabled={testingRealtimeVoice}
                  onClick={() => void testRealtimeVoiceSettings()}
                >
                  {testingRealtimeVoice ? '检测中' : '检测实时语音'}
                </button>
                <button type="button" disabled={testingRealtimeVoice} onClick={() => void saveRealtimeVoiceSettings()}>
                  保存语音设置
                </button>
              </div>
              <p className="settings-footnote">
                检测只验证服务、Live Voice 路由和代理密钥，不会创建通话；ChatGPT 账户的实际语音权益会在建联时最终确认。
              </p>
            </div>

            <p className="runtime-line">
              版本 {runtimeInfo?.version ?? version} · Electron（桌面应用运行框架）{runtimeInfo?.electron ?? '未知'} ·
              {runtimeInfo?.platform ?? '浏览器'} {runtimeInfo?.arch ?? ''}
              {runtimeInfo?.packaged ? ' · 已打包' : ''}
            </p>
          </section>
        ) : null}

        {memoryOpen ? (
          <section className="memory-panel" aria-label="长期记忆">
            <div className="panel-heading">
              <span>长期记忆</span>
              <small>{memories.filter((memory) => memory.enabled).length} 启用</small>
            </div>
            <label>
              记忆内容
              <textarea value={memoryDraft} onChange={(event) => setMemoryDraft(event.target.value)} rows={3} />
            </label>
            <div className="memory-editor-actions">
              <button type="button" onClick={() => void saveMemory()}>
                <Check size={14} />
                {editingMemoryId ? '保存修改' : '保存记忆'}
              </button>
              {editingMemoryId ? (
                <button type="button" onClick={cancelMemoryEdit}>
                  <X size={14} />
                  取消
                </button>
              ) : null}
            </div>
            <div className="memory-items">
              {memories.length === 0 ? <p className="empty-line">暂无长期记忆</p> : null}
              {memories.map((memory) => (
                <article className={`memory-item ${memory.enabled ? '' : 'is-disabled'}`} key={memory.id}>
                  <p>{memory.content}</p>
                  <div className="memory-actions">
                    <button type="button" onClick={() => void toggleMemory(memory)}>
                      {memory.enabled ? '停用' : '启用'}
                    </button>
                    <button type="button" title="编辑记忆" onClick={() => editMemory(memory)}>
                      <Pencil size={13} />
                    </button>
                    <button type="button" title="删除记忆" onClick={() => void deleteMemory(memory)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {microphone.error || error ? <p className="error-line">{microphone.error ?? error}</p> : null}
      </section>
    </main>
  )
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return '请求失败，请检查模型配置。'
}

function withoutBlankApiKey(input: Partial<ModelConfig>): Partial<ModelConfig> {
  if (input.apiKey !== undefined && input.apiKey.trim() === '') {
    const { apiKey: _apiKey, ...rest } = input
    return rest
  }
  return input
}

function withoutBlankRealtimeVoiceApiKey(
  input: Partial<RealtimeVoiceConfig>
): Partial<RealtimeVoiceConfig> {
  if (input.apiKey !== undefined && input.apiKey.trim() === '') {
    const { apiKey: _apiKey, ...rest } = input
    return rest
  }
  return input
}

function createIdleTypewriterState(): TypewriterState {
  return {
    requestId: null,
    target: '',
    visible: '',
    finalMessage: null,
    done: false,
    frameId: 0,
    timerId: 0
  }
}

function renderMarkdown(markdown: string): JSX.Element[] {
  const lines = markdown.split(/\r?\n/)
  const nodes: JSX.Element[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    if (line.startsWith('```')) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index].startsWith('```')) {
        code.push(lines[index])
        index += 1
      }
      index += 1
      nodes.push(
        <pre key={`code-${index}`}>
          <code>{code.join('\n')}</code>
        </pre>
      )
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const text = renderInline(heading[2])
      nodes.push(level === 1 ? <h2 key={`h-${index}`}>{text}</h2> : level === 2 ? <h3 key={`h-${index}`}>{text}</h3> : <h4 key={`h-${index}`}>{text}</h4>)
      index += 1
      continue
    }

    if (/^\|.+\|$/.test(line.trim())) {
      const rows: string[][] = []
      while (index < lines.length && /^\|.+\|$/.test(lines[index].trim())) {
        const cells = lines[index]
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((cell) => cell.trim())
        if (!cells.every((cell) => /^:?-{3,}:?$/.test(cell))) {
          rows.push(cells)
        }
        index += 1
      }
      const [head, ...body] = rows
      nodes.push(
        <table key={`table-${index}`}>
          <thead>
            <tr>{head?.map((cell, cellIndex) => <th key={`th-${cellIndex}`}>{renderInline(cell)}</th>)}</tr>
          </thead>
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={`tr-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`td-${cellIndex}`}>{renderInline(cell)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      )
      continue
    }

    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ''))
        index += 1
      }
      nodes.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`li-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    if (/^\d+[.)、]\s+/.test(line.trim())) {
      const items: string[] = []
      while (index < lines.length && /^\d+[.)、]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+[.)、]\s+/, ''))
        index += 1
      }
      nodes.push(
        <ol key={`ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={`oli-${itemIndex}`}>{renderInline(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    const paragraph: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,3})\s+/.test(lines[index]) &&
      !/^[-*]\s+/.test(lines[index].trim()) &&
      !/^\d+[.)、]\s+/.test(lines[index].trim()) &&
      !/^\|.+\|$/.test(lines[index].trim()) &&
      !lines[index].startsWith('```')
    ) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    nodes.push(<p key={`p-${index}`}>{renderInline(paragraph.join(' '))}</p>)
  }

  return nodes
}

function renderInline(text: string): Array<string | JSX.Element> {
  const parts: Array<string | JSX.Element> = []
  const pattern = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)]+)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[2]) {
      parts.push(<strong key={`strong-${match.index}`}>{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(<code key={`inline-code-${match.index}`}>{match[3]}</code>)
    } else if (match[4] && match[5]) {
      parts.push(
        <a key={`link-${match.index}`} href={match[5]} target="_blank" rel="noreferrer">
          {match[4]}
        </a>
      )
    }
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}
