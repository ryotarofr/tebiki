import { Select, createListCollection } from '@ark-ui/solid/select'
import { Field } from '@ark-ui/solid/field'
import { Dialog } from '@ark-ui/solid/dialog'
import { RadioGroup } from '@ark-ui/solid/radio-group'
import { Portal } from 'solid-js/web'
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  SortableProvider,
  createSortable,
  createDroppable,
  type DragEvent,
} from '@thisbeyond/solid-dnd'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  LayoutGridIcon,
  StarIcon,
  TagIcon,
  TriangleAlertIcon,
  UserIcon,
  SearchIcon,
  GripVerticalIcon,
  SettingsIcon,
  XIcon,
} from 'lucide-solid'
import { For, createSignal, createMemo, Show, batch, createContext, useContext, createEffect, onCleanup } from 'solid-js'
import type { JSX, Accessor } from 'solid-js'
import styles from './index.module.css'

// アイコンタイプの定義
type IconType = 'grid' | 'star' | 'tag' | 'alert' | 'user'

// ドロップ位置の型
type DropPosition = 'before' | 'after' | 'inside' | null

// サイドバー位置の型
export type SidebarPosition = 'left' | 'right'

// フラット構造のナビゲーションアイテム型定義
export interface NavItem {
  id: string
  name: string
  icon: IconType
  iconColor?: string
  parentId?: string | null
  order?: number
}

// 階層構造用の内部型
interface TreeNode extends NavItem {
  children: TreeNode[]
  depth: number
}

// パネルオプションの型定義
export interface PanelOption {
  label: string
  value: string
}

// サイドバーの幅設定（単位: px）
const DEFAULT_WIDTH = 280   // デフォルト幅
const MIN_WIDTH = 200       // 最小幅
const MAX_WIDTH = 500       // 最大幅
const COLLAPSED_WIDTH = 48  // 折り畳み時の幅

// Sidebarのプロパティ
export interface SidebarProps {
  panels: PanelOption[]
  items: NavItem[]
  selectedPanel?: string
  selectedItemId?: string
  position?: SidebarPosition
  width?: number
  minWidth?: number
  maxWidth?: number
  collapsed?: boolean
  onPanelChange?: (value: string) => void
  onItemSelect?: (item: NavItem) => void
  onItemsChange?: (items: NavItem[]) => void
  onPositionChange?: (position: SidebarPosition) => void
  onWidthChange?: (width: number) => void
  onCollapsedChange?: (collapsed: boolean) => void
  searchPlaceholder?: string
}

// ドラッグコンテキスト
interface DragContextValue {
  activeId: Accessor<string | null>
  overId: Accessor<string | null>
  dropPosition: Accessor<DropPosition>
}

const DragContext = createContext<DragContextValue>()

// アイコンコンポーネント
const NavIcon = (props: { type: IconType; color?: string }) => {
  const iconStyle = (): JSX.CSSProperties => ({
    color: props.color || 'currentColor',
  })

  switch (props.type) {
    case 'grid':
      return <LayoutGridIcon style={iconStyle()} />
    case 'star':
      return <StarIcon style={iconStyle()} />
    case 'tag':
      return <TagIcon style={iconStyle()} />
    case 'alert':
      return <TriangleAlertIcon style={iconStyle()} />
    case 'user':
      return <UserIcon style={iconStyle()} />
    default:
      return <LayoutGridIcon style={iconStyle()} />
  }
}

// フラットなアイテムから階層構造を構築
const buildTree = (items: NavItem[]): TreeNode[] => {
  const itemMap = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  // 全アイテムをマップに登録
  for (const item of items) {
    itemMap.set(item.id, { ...item, children: [], depth: 0 })
  }

  // 親子関係を構築
  for (const item of items) {
    const node = itemMap.get(item.id)
    if (!node) continue
    if (item.parentId && itemMap.has(item.parentId)) {
      const parent = itemMap.get(item.parentId)
      if (parent) {
        node.depth = parent.depth + 1
        parent.children.push(node)
      }
    } else {
      roots.push(node)
    }
  }

  // orderでソート
  const sortByOrder = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((node) => ({
        ...node,
        children: sortByOrder(node.children),
      }))
  }

  return sortByOrder(roots)
}

// 階層構造をフラット化（表示順）
const flattenTree = (nodes: TreeNode[]): TreeNode[] => {
  const result: TreeNode[] = []
  const traverse = (items: TreeNode[]) => {
    for (const item of items) {
      result.push(item)
      if (item.children.length > 0) {
        traverse(item.children)
      }
    }
  }
  traverse(nodes)
  return result
}

// 自動展開の遅延時間（ミリ秒）
const AUTO_EXPAND_DELAY = 500

export const Sidebar = (props: SidebarProps) => {
  const [searchQuery, setSearchQuery] = createSignal('')
  const [expandedItems, setExpandedItems] = createSignal<string[]>([])
  const [selectedItem, setSelectedItem] = createSignal<string>(props.selectedItemId || '')
  const [activeId, setActiveId] = createSignal<string | null>(null)
  const [overId, setOverId] = createSignal<string | null>(null)
  const [dropPosition, setDropPosition] = createSignal<DropPosition>(null)

  // 自動展開用のタイマー
  let expandTimerRef: ReturnType<typeof setTimeout> | null = null

  // props.selectedItemId の変更を監視して同期
  createEffect(() => {
    const newSelectedId = props.selectedItemId
    if (newSelectedId !== undefined && newSelectedId !== selectedItem()) {
      setSelectedItem(newSelectedId)
    }
  })

  // マウス位置を追跡し、ドロップ位置を更新
  const handleMouseMove = (e: MouseEvent) => {
    const currentOverId = overId()
    if (!currentOverId) return

    const droppableElement = document.querySelector(`[data-item-id="${currentOverId}"]`)
    if (!droppableElement) return

    const rect = droppableElement.getBoundingClientRect()
    const relativeY = e.clientY - rect.top
    const threshold = rect.height / 3

    // 子を持つアイテムの場合のみ'inside'を許可
    const itemHasChildren = hasChildren(currentOverId)

    let newPosition: DropPosition
    if (relativeY < threshold) {
      newPosition = 'before'
    } else if (relativeY > rect.height - threshold) {
      newPosition = 'after'
    } else if (itemHasChildren) {
      newPosition = 'inside'
    } else {
      newPosition = 'after'
    }

    // 位置が変わった場合のみ更新
    if (dropPosition() !== newPosition) {
      setDropPosition(newPosition)
    }
  }

  // マウスイベントリスナーを設定
  createEffect(() => {
    if (activeId()) {
      document.addEventListener('mousemove', handleMouseMove)
    } else {
      document.removeEventListener('mousemove', handleMouseMove)
    }
  })

  // 自動展開: createEffectでリアクティブに監視
  createEffect(() => {
    const currentOverId = overId()
    const currentDropPosition = dropPosition()
    const currentActiveId = activeId()

    // タイマーをクリア
    if (expandTimerRef) {
      clearTimeout(expandTimerRef)
      expandTimerRef = null
    }

    // ドラッグ中でない、またはホバーしていない場合は何もしない
    if (!currentActiveId || !currentOverId) return

    // 子を持つ閉じたアイテムの中央部分にホバーしている場合
    const itemHasChildren = hasChildren(currentOverId)
    const isCollapsed = !expandedItems().includes(currentOverId)
    const isHoveringInside = currentDropPosition === 'inside'

    if (itemHasChildren && isCollapsed && isHoveringInside) {
      expandTimerRef = setTimeout(() => {
        // タイマー発火時にまだ同じ条件を満たしているか確認
        if (overId() === currentOverId && dropPosition() === 'inside' && activeId()) {
          setExpandedItems((prev) => [...prev, currentOverId])
        }
      }, AUTO_EXPAND_DELAY)
    }
  })

  // クリーンアップ
  onCleanup(() => {
    document.removeEventListener('mousemove', handleMouseMove)
    if (expandTimerRef) {
      clearTimeout(expandTimerRef)
      expandTimerRef = null
    }
    // リサイズ中にコンポーネントがアンマウントされた場合のクリーンアップ
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  })

  // パネルコレクション
  const panelCollection = createMemo(() =>
    createListCollection({
      items: props.panels,
      itemToValue: (item) => item.value,
      itemToString: (item) => item.label,
    })
  )

  // 階層構造を構築
  const tree = createMemo(() => buildTree(props.items))

  // フラット化されたアイテム（表示用）
  const flatItems = createMemo(() => {
    const allFlat = flattenTree(tree())
    const query = searchQuery().toLowerCase()

    if (!query) {
      // 展開されていないアイテムの子は表示しない
      return allFlat.filter((item) => {
        if (!item.parentId) return true
        // 全ての祖先が展開されているか確認
        let currentParentId: string | null | undefined = item.parentId
        while (currentParentId) {
          if (!expandedItems().includes(currentParentId)) return false
          const parent = allFlat.find((i) => i.id === currentParentId)
          currentParentId = parent?.parentId
        }
        return true
      })
    }

    // 検索時はマッチしたアイテムとその祖先を表示
    const matchedIds = new Set<string>()
    for (const item of allFlat) {
      if (item.name.toLowerCase().includes(query)) {
        matchedIds.add(item.id)
        // 祖先も追加
        let currentParentId: string | null | undefined = item.parentId
        while (currentParentId) {
          matchedIds.add(currentParentId)
          const parent = allFlat.find((i) => i.id === currentParentId)
          currentParentId = parent?.parentId
        }
      }
    }

    return allFlat.filter((item) => matchedIds.has(item.id))
  })

  // 子を持つかどうかを判定
  const hasChildren = (id: string) => {
    return props.items.some((item) => item.parentId === id)
  }

  // 展開/折りたたみのトグル
  const toggleExpanded = (id: string) => {
    setExpandedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // アイテム選択ハンドラ
  const handleItemSelect = (item: NavItem) => {
    setSelectedItem(item.id)
    props.onItemSelect?.(item)
  }

  // ドラッグ開始ハンドラ
  const onDragStart = ({ draggable }: DragEvent) => {
    setActiveId(String(draggable.id))
  }

  // ドラッグオーバーハンドラ（droppableの上にドラッグされた時）
  const onDragOver = (event: DragEvent) => {
    const { droppable } = event

    if (!droppable) {
      setOverId(null)
      setDropPosition(null)
      return
    }

    const droppableId = String(droppable.id)
    setOverId(droppableId)
    // dropPositionはhandleMouseMoveで更新される
  }

  // ドラッグ終了ハンドラ
  const onDragEnd = (event: DragEvent) => {
    const { draggable, droppable } = event

    if (!droppable) {
      resetDragState()
      return
    }

    const dragId = String(draggable.id)
    const dropId = String(droppable.id)

    if (dragId === dropId) {
      resetDragState()
      return
    }

    const items = [...props.items]
    const dragItem = items.find((i) => i.id === dragId)
    const dropItem = items.find((i) => i.id === dropId)

    if (!dragItem || !dropItem) {
      resetDragState()
      return
    }

    const currentDropPosition = dropPosition()

    batch(() => {
      let newParentId: string | null | undefined
      let newOrder: number

      if (currentDropPosition === 'inside') {
        // 子として追加
        newParentId = dropId
        const siblings = items.filter((i) => i.parentId === dropId)
        newOrder = siblings.length
        // 親を展開
        if (!expandedItems().includes(dropId)) {
          setExpandedItems((prev) => [...prev, dropId])
        }
      } else {
        // 同じ親の兄弟として追加
        newParentId = dropItem.parentId
        const siblings = items.filter((i) => i.parentId === dropItem.parentId && i.id !== dragId)
        const dropItemIndex = siblings.findIndex((i) => i.id === dropId)
        newOrder = currentDropPosition === 'before' ? dropItemIndex : dropItemIndex + 1
      }

      // 新しいアイテム配列を作成
      const newItems = items.map((item) => {
        if (item.id === dragId) {
          return {
            ...item,
            parentId: newParentId,
            order: newOrder,
          }
        }
        // 同じ親の兄弟のorderを再計算
        if (item.parentId === newParentId && item.id !== dragId) {
          const siblings = items.filter((i) => i.parentId === newParentId && i.id !== dragId)
          const currentIndex = siblings.findIndex((i) => i.id === item.id)
          return {
            ...item,
            order: currentIndex >= newOrder ? currentIndex + 1 : currentIndex,
          }
        }
        return item
      })

      props.onItemsChange?.(newItems)
    })

    resetDragState()
  }

  const resetDragState = () => {
    setActiveId(null)
    setOverId(null)
    setDropPosition(null)
  }

  const ids = createMemo(() => flatItems().map((item) => item.id))

  const dragContextValue: DragContextValue = {
    activeId,
    overId,
    dropPosition,
  }

  // 設定ダイアログの状態
  const [isSettingsOpen, setIsSettingsOpen] = createSignal(false)

  // 現在の位置（propsから取得、デフォルトは'left'）
  const currentPosition = () => props.position || 'left'

  // 幅の設定
  const currentWidth = () => props.width ?? DEFAULT_WIDTH
  const minWidth = () => props.minWidth ?? MIN_WIDTH
  const maxWidth = () => props.maxWidth ?? MAX_WIDTH

  // 折り畳み状態
  const isCollapsed = () => props.collapsed ?? false

  // 折り畳みトグル
  const toggleCollapsed = () => {
    props.onCollapsedChange?.(!isCollapsed())
  }

  // リサイズ状態
  const [isResizing, setIsResizing] = createSignal(false)

  // リサイズハンドラ
  const handleResizeStart = (e: MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)

    const startX = e.clientX
    const startWidth = currentWidth()
    const isRight = currentPosition() === 'right'

    const handleResizeMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      // 右側サイドバーの場合は方向を反転
      const newWidth = isRight ? startWidth - deltaX : startWidth + deltaX
      const clampedWidth = Math.min(Math.max(newWidth, minWidth()), maxWidth())
      props.onWidthChange?.(clampedWidth)
    }

    const handleResizeEnd = () => {
      setIsResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleResizeMove)
      document.removeEventListener('mouseup', handleResizeEnd)
    }

    // リサイズ中はカーソルとユーザー選択を固定
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', handleResizeMove)
    document.addEventListener('mouseup', handleResizeEnd)
  }

  // 位置変更ハンドラ
  const handlePositionChange = (details: { value: string | null }) => {
    if (details.value) {
      props.onPositionChange?.(details.value as SidebarPosition)
    }
  }

  return (
    <aside
      class={styles.Sidebar}
      classList={{
        [styles.SidebarRight]: currentPosition() === 'right',
        [styles.SidebarResizing]: isResizing(),
        [styles.SidebarCollapsed]: isCollapsed(),
      }}
      style={{ width: isCollapsed() ? `${COLLAPSED_WIDTH}px` : `${currentWidth()}px` }}
    >
      {/* リサイズハンドル（折り畳み時は非表示） */}
      <Show when={!isCollapsed()}>
        <button
          type="button"
          aria-label="サイドバーの幅を調整"
          class={styles.ResizeHandle}
          classList={{
            [styles.ResizeHandleRight]: currentPosition() === 'left',
            [styles.ResizeHandleLeft]: currentPosition() === 'right',
          }}
          onMouseDown={handleResizeStart}
          onKeyDown={(e) => {
            // キーボードでもリサイズ可能にする
            const step = e.shiftKey ? 50 : 10
            if (e.key === 'ArrowLeft') {
              const newWidth = currentPosition() === 'left'
                ? currentWidth() - step
                : currentWidth() + step
              props.onWidthChange?.(Math.min(Math.max(newWidth, minWidth()), maxWidth()))
            } else if (e.key === 'ArrowRight') {
              const newWidth = currentPosition() === 'left'
                ? currentWidth() + step
                : currentWidth() - step
              props.onWidthChange?.(Math.min(Math.max(newWidth, minWidth()), maxWidth()))
            }
          }}
        />
      </Show>

      {/* 折り畳みトグルボタン */}
      <div class={styles.CollapseToggle}>
        <button
          type="button"
          class={styles.CollapseButton}
          aria-label={isCollapsed() ? 'サイドバーを展開' : 'サイドバーを折り畳む'}
          onClick={toggleCollapsed}
        >
          <Show
            when={isCollapsed()}
            fallback={
              currentPosition() === 'left' ? <ChevronsLeftIcon /> : <ChevronsRightIcon />
            }
          >
            {currentPosition() === 'left' ? <ChevronsRightIcon /> : <ChevronsLeftIcon />}
          </Show>
        </button>
      </div>

      {/* ヘッダー: パネル選択ドロップダウン（折り畳み時は非表示） */}
      <Show when={!isCollapsed()}>
        <div class={styles.Header}>
          <Select.Root
            collection={panelCollection()}
            value={props.selectedPanel ? [props.selectedPanel] : [props.panels[0]?.value]}
            onValueChange={(details) => props.onPanelChange?.(details.value[0])}
          >
            <Select.Control class={styles.SelectControl}>
              <Select.Trigger class={styles.SelectTrigger}>
                <Select.ValueText placeholder="パネルを選択" />
                <ChevronDownIcon class={styles.SelectIcon} />
              </Select.Trigger>
            </Select.Control>
            <Select.Positioner>
              <Select.Content class={styles.SelectContent}>
                <For each={props.panels}>
                  {(panel) => (
                    <Select.Item item={panel} class={styles.SelectItem}>
                      <Select.ItemText>{panel.label}</Select.ItemText>
                    </Select.Item>
                  )}
                </For>
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
        </div>

        {/* 検索フィールド */}
        <div class={styles.SearchContainer}>
          <Field.Root class={styles.SearchField}>
            <Field.Input
              class={styles.SearchInput}
              placeholder={props.searchPlaceholder || '入力してEnterキーを押してください'}
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
            />
            <SearchIcon class={styles.SearchIcon} />
          </Field.Root>
        </div>
      </Show>

      {/* ナビゲーションリスト（折り畳み時は非表示） */}
      <Show when={!isCollapsed()}>
        <nav class={styles.Nav}>
          <DragContext.Provider value={dragContextValue}>
            <DragDropProvider
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={onDragEnd}
            >
              <DragDropSensors />
              <ul class={styles.NavList}>
                <SortableProvider ids={ids()}>
                  <For each={flatItems()}>
                    {(item) => (
                      <SortableNavItem
                        item={item}
                        isExpanded={expandedItems().includes(item.id)}
                        isSelected={selectedItem() === item.id}
                        hasChildren={hasChildren(item.id)}
                        onToggle={toggleExpanded}
                        onSelect={handleItemSelect}
                      />
                    )}
                  </For>
                </SortableProvider>
              </ul>
              <DragOverlay>
                <Show when={activeId()}>
                  {(id) => {
                    const item = () => flatItems().find((i) => i.id === id())
                    return (
                      <Show when={item()}>
                        {(activeItem) => (
                          <div class={styles.DragOverlay}>
                            <span class={styles.NavItemIcon}>
                              <NavIcon type={activeItem().icon} color={activeItem().iconColor} />
                            </span>
                            <span class={styles.NavItemText}>{activeItem().name}</span>
                          </div>
                        )}
                      </Show>
                    )
                  }}
                </Show>
              </DragOverlay>
            </DragDropProvider>
          </DragContext.Provider>
        </nav>

        {/* フッター: 設定ボタン */}
        <div class={styles.Footer}>
          <Dialog.Root open={isSettingsOpen()} onOpenChange={(e) => setIsSettingsOpen(e.open)}>
            <Dialog.Trigger class={styles.SettingsButton}>
              <SettingsIcon />
              <span>設定</span>
            </Dialog.Trigger>
          <Portal>
            <Dialog.Backdrop class={styles.DialogBackdrop} />
            <Dialog.Positioner class={styles.DialogPositioner}>
              <Dialog.Content class={styles.DialogContent}>
                <Dialog.Title class={styles.DialogTitle}>サイドバー設定</Dialog.Title>
                <Dialog.Description class={styles.DialogDescription}>
                  サイドバーの表示位置を設定します。
                </Dialog.Description>

                <div class={styles.DialogBody}>
                  <RadioGroup.Root
                    value={currentPosition()}
                    onValueChange={handlePositionChange}
                    class={styles.RadioGroup}
                  >
                    <RadioGroup.Label class={styles.RadioGroupLabel}>
                      サイドバーの位置
                    </RadioGroup.Label>
                    <div class={styles.RadioOptions}>
                      <RadioGroup.Item value="left" class={styles.RadioItem}>
                        <RadioGroup.ItemControl class={styles.RadioControl} />
                        <RadioGroup.ItemText class={styles.RadioText}>左側</RadioGroup.ItemText>
                        <RadioGroup.ItemHiddenInput />
                      </RadioGroup.Item>
                      <RadioGroup.Item value="right" class={styles.RadioItem}>
                        <RadioGroup.ItemControl class={styles.RadioControl} />
                        <RadioGroup.ItemText class={styles.RadioText}>右側</RadioGroup.ItemText>
                        <RadioGroup.ItemHiddenInput />
                      </RadioGroup.Item>
                    </div>
                  </RadioGroup.Root>
                </div>

                <div class={styles.DialogFooter}>
                  <Dialog.CloseTrigger class={styles.DialogCloseButton}>
                    閉じる
                  </Dialog.CloseTrigger>
                </div>

                <Dialog.CloseTrigger class={styles.DialogCloseIcon}>
                  <XIcon />
                </Dialog.CloseTrigger>
              </Dialog.Content>
            </Dialog.Positioner>
          </Portal>
        </Dialog.Root>
        </div>
      </Show>
    </aside>
  )
}

// ソート可能なナビゲーションアイテムコンポーネント
interface SortableNavItemProps {
  item: TreeNode
  isExpanded: boolean
  isSelected: boolean
  hasChildren: boolean
  onToggle: (id: string) => void
  onSelect: (item: NavItem) => void
}

const SortableNavItem = (props: SortableNavItemProps) => {
  const sortable = createSortable(props.item.id)
  const droppable = createDroppable(props.item.id)
  const dragContext = useContext(DragContext)

  const isDropTarget = () => dragContext?.overId() === props.item.id && dragContext?.activeId() !== props.item.id
  const currentDropPosition = () => isDropTarget() ? dragContext?.dropPosition() : null

  return (
    <li
      ref={(el) => {
        sortable.ref(el)
        droppable.ref(el)
      }}
      class={styles.NavItem}
      classList={{
        [styles.NavItemDragging]: sortable.isActiveDraggable,
        [styles.NavItemDropTargetBefore]: currentDropPosition() === 'before',
        [styles.NavItemDropTargetAfter]: currentDropPosition() === 'after',
        [styles.NavItemDropTargetInside]: currentDropPosition() === 'inside',
      }}
      data-item-id={props.item.id}
    >
      {/* ドロップインジケーター（前） */}
      <Show when={currentDropPosition() === 'before'}>
        <div
          class={styles.DropIndicator}
          style={{ '--depth': props.item.depth }}
        />
      </Show>

      <button
        type="button"
        class={styles.NavItemButton}
        classList={{
          [styles.NavItemSelected]: props.isSelected,
          [styles.NavItemHasChildren]: props.hasChildren,
          [styles.NavItemDropHighlight]: currentDropPosition() === 'inside',
        }}
        style={{ '--depth': props.item.depth }}
        onClick={() => {
          if (props.hasChildren) {
            props.onToggle(props.item.id)
          }
          props.onSelect(props.item)
        }}
        {...sortable.dragActivators}
      >
        <span class={styles.DragHandle}>
          <GripVerticalIcon />
        </span>
        <Show when={props.hasChildren}>
          <span
            class={styles.NavItemIndicator}
            classList={{ [styles.NavItemIndicatorOpen]: props.isExpanded }}
          >
            <ChevronRightIcon />
          </span>
        </Show>
        <span class={styles.NavItemIcon}>
          <NavIcon type={props.item.icon} color={props.item.iconColor} />
        </span>
        <span class={styles.NavItemText}>{props.item.name}</span>
      </button>

      {/* ドロップインジケーター（後） */}
      <Show when={currentDropPosition() === 'after'}>
        <div
          class={styles.DropIndicator}
          style={{ '--depth': props.item.depth }}
        />
      </Show>
    </li>
  )
}

export default Sidebar
