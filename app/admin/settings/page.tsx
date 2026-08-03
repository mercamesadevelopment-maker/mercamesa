'use client';

import React, { useState } from 'react';
import { FolderTree, Scale, LayoutGrid, FileCheck, Settings2, Store, Wallet } from 'lucide-react';
import { CategoriesTab } from './components/categories-tab';
import { MeasurementUnitsTab } from './components/measurement-units-tab';
import { ModulesTab } from './components/modules-tab';
import { DocumentTypesTab } from './components/document-types-tab';
import { StoreCategoriesTab } from './components/store-categories-tab';
import { OrderMinPriceTab } from './components/order-min-price-tab';

type TabKey = 'categories' | 'units' | 'modules' | 'documents' | 'store_categories' | 'order_min_price';

const TABS: { key: TabKey; label: string; icon: React.ElementType; description: string }[] = [
  {
    key: 'categories',
    label: 'Categorías',
    icon: FolderTree,
    description: 'Catálogo de categorías y subcategorías de productos',
  },
  {
    key: 'units',
    label: 'Unidades de Medida',
    icon: Scale,
    description: 'Unidades estándar para comercialización de productos',
  },
  {
    key: 'modules',
    label: 'Módulos del Sistema',
    icon: LayoutGrid,
    description: 'Rutas y módulos disponibles en la plataforma',
  },
  {
    key: 'documents',
    label: 'Tipos de Documento',
    icon: FileCheck,
    description: 'Requisitos documentales para verificación de comercios',
  },
  {
    key: 'store_categories',
    label: 'Categorías de Tienda',
    icon: Store,
    description: 'Clasificación del tipo de negocio de cada tienda (Frutería, Carnicería, etc.)',
  },
  {
    key: 'order_min_price',
    label: 'Precio Mínimo de Orden',
    icon: Wallet,
    description: 'Valor mínimo requerido para completar un pedido.',
  },
];

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('categories');

  const currentTabObj = TABS.find((t) => t.key === activeTab) || TABS[0];

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-mm-crd/40 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-mm-g text-white rounded-2xl flex items-center justify-center shadow-md">
              <Settings2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-fraunces text-mm-g">Parametrización del Sistema</h1>
              <p className="text-sm text-mm-txs mt-0.5">
                Administra los catálogos globales y configuraciones maestras de Mercamesa.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-mm-crd/50 pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-mm-g text-white shadow-md shadow-mm-g/20 scale-[1.02]'
                  : 'bg-white text-mm-txs hover:text-mm-g hover:bg-mm-gbg/60 border border-mm-crd/30'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-mm-txw'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Context Card */}
      <div className="bg-mm-gbg/20 p-4 rounded-2xl border border-mm-crd/30 flex items-center justify-between">
        <p className="text-xs text-mm-txs font-medium">
          {currentTabObj.description}
        </p>
      </div>

      {/* Tab Contents */}
      <div className="bg-white p-6 lg:p-8 rounded-[32px] border border-mm-crd shadow-sm">
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'units' && <MeasurementUnitsTab />}
        {activeTab === 'modules' && <ModulesTab />}
        {activeTab === 'documents' && <DocumentTypesTab />}
        {activeTab === 'store_categories' && <StoreCategoriesTab />}
        {activeTab === 'order_min_price' && <OrderMinPriceTab />}
      </div>
    </div>
  );
}
