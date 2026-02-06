import { A } from "@solidjs/router";
import { createSignal } from "solid-js";
import type { ParentProps } from "solid-js";
import { Sidebar, type NavItem, type PanelOption, type SidebarPosition } from "./components/Sidebar";
import "./App.css";

// サンプルパネルオプション
const panelOptions: PanelOption[] = [
	{ label: "AIデータパネル", value: "ai-data" },
	{ label: "分析パネル", value: "analysis" },
	{ label: "レポートパネル", value: "reports" },
];

// サンプルナビゲーションアイテム（フラット構造）
const initialNavItems: NavItem[] = [
	{ id: "1", name: "銘柄ボード", icon: "grid", order: 0 },
	{ id: "2", name: "タグ新規作成から更新", icon: "star", order: 1 },
	{ id: "2-1", name: "自由なダッシュボード", icon: "grid", parentId: "2", order: 0 },
	{ id: "2-2", name: "汎用動作確認(渡邊)", icon: "grid", parentId: "2", order: 1 },
	{ id: "3", name: "タグ新規作成2", icon: "tag", iconColor: "#9c27b0", order: 2 },
	{ id: "3-1", name: "新規追加", icon: "grid", parentId: "3", order: 0 },
	{ id: "3-2", name: "デグレ再現確認", icon: "grid", parentId: "3", order: 1 },
	{ id: "4", name: "地域カルテ", icon: "grid", order: 3 },
	{ id: "5", name: "FACTSHEET", icon: "grid", order: 4 },
	{ id: "6", name: "パネルコピーテスト2", icon: "star", order: 5 },
	{ id: "7", name: "新規作成", icon: "alert", iconColor: "#ff9800", order: 6 },
	{ id: "8", name: "テストユーザ005へ共有", icon: "user", iconColor: "#9c27b0", order: 7 },
	{
		id: "9",
		name: "遥かなる未来、AIと人間が織りなす壮大な叙事詩...",
		icon: "user",
		iconColor: "#9c27b0",
		order: 8,
	},
	{ id: "10", name: "遠藤テスト", icon: "user", iconColor: "#9c27b0", order: 9 },
	{ id: "11", name: "テスト（テスト用）", icon: "grid", order: 10 },
	{ id: "11-1", name: "ダッシュボード", icon: "grid", parentId: "11", order: 0 },
	{ id: "11-2", name: "ファクトチェック確認用（吉澤）", icon: "grid", parentId: "11", order: 1 },
	{ id: "11-3", name: "ダッシュボード", icon: "grid", parentId: "11-2", order: 0 },
	{ id: "11-4", name: "ファクトチェック確認用（吉澤）", icon: "grid", parentId: "11-2", order: 1 },
];

function App(props: ParentProps) {
	const [selectedPanel, setSelectedPanel] = createSignal("ai-data");
	const [selectedItem, setSelectedItem] = createSignal<NavItem | null>(null);
	const [navItems, setNavItems] = createSignal<NavItem[]>(initialNavItems);
	const [sidebarPosition, setSidebarPosition] = createSignal<SidebarPosition>("left");
	const [sidebarWidth, setSidebarWidth] = createSignal(280);
	const [sidebarCollapsed, setSidebarCollapsed] = createSignal(false);

	return (
		<div
			class="app-layout"
			classList={{
				"sidebar-right": sidebarPosition() === "right",
			}}
		>
			<Sidebar
				panels={panelOptions}
				items={navItems()}
				selectedPanel={selectedPanel()}
				selectedItemId={selectedItem()?.id}
				position={sidebarPosition()}
				width={sidebarWidth()}
				collapsed={sidebarCollapsed()}
				onPanelChange={setSelectedPanel}
				onItemSelect={setSelectedItem}
				onItemsChange={setNavItems}
				onPositionChange={setSidebarPosition}
				onWidthChange={setSidebarWidth}
				onCollapsedChange={setSidebarCollapsed}
			/>
			<main class="main-content">
				<nav class="row" style={{ "margin-bottom": "1rem", gap: "1rem" }}>
					<A href="/" end>
						Home
					</A>
					<A href="/about">About</A>
					<A href="/editor">Editor</A>
					<A href="/user/123">User (id=123)</A>
					<A href="/dashboard">Dashboard</A>
				</nav>
				<hr />
				{props.children}
			</main>
		</div>
	);
}

export default App;
