import './toolbar-action-popup.js';

import {
  DatabaseSearchClose,
  DatabaseSearchIcon,
  MoreHorizontalIcon,
  PlusIcon,
} from '@blocksuite/global/config';
import { createPopper } from '@popperjs/core';
import { css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';

import {
  ShadowlessElement,
  WithDisposable,
} from '../../../__internal__/index.js';
import type { DatabaseBlockModel } from '../../database-model.js';
import { SearchState } from '../../types.js';
import { onClickOutside } from '../../utils.js';
import { initAddNewRecordHandlers } from './index.js';
import { ToolbarActionPopup } from './toolbar-action-popup.js';

type CellValues = string[];

/**
 * Containing all the cell values in rows.
 * ```
 * { rowId: CellValues }
 * ```
 */
type DatabaseMap = Record<string, CellValues>;

const styles = css`
  .affine-database-toolbar {
    display: none;
    align-items: center;
    gap: 26px;
  }
  .affine-database-toolbar-search svg,
  .affine-database-toolbar svg {
    width: 16px;
    height: 16px;
  }
  .affine-database-toolbar-item {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .affine-database-toolbar-item.search-container {
    overflow: hidden;
  }
  .affine-database-toolbar-item.search {
    overflow: hidden;
  }
  .affine-database-toolbar-item.more-action {
    width: 32px;
    height: 32px;
    border-radius: 4px;
  }
  .affine-database-toolbar-item.more-action:hover,
  .more-action.active {
    background: var(--affine-hover-background);
  }
  .affine-database-search-container {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 16px;
    height: 32px;
    padding: 8px 0;
    border-radius: 8px;
    transition: all 0.3s ease;
  }
  .affine-database-search-container > svg {
    min-width: 16px;
    min-height: 16px;
  }
  .search-container-expand {
    width: 138px;
    padding: 8px 12px;
    background-color: var(--affine-hover-background);
  }
  .search-input-container {
    display: flex;
    align-items: center;
  }
  .search-input-container > .close-icon {
    display: flex;
    align-items: center;
  }
  .close-icon .code {
    width: 31px;
    height: 18px;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--affine-white-10);
  }
  .affine-database-search-input-icon {
    display: inline-flex;
  }
  .affine-database-search-input {
    flex: 1;
    height: 16px;
    width: 80px;
    border: none;
    font-family: var(--affine-font-family);
    font-size: var(--affine-font-sm);
    box-sizing: border-box;
    color: inherit;
    background: transparent;
  }
  .affine-database-search-input:focus {
    outline: none;
  }
  .affine-database-search-input::placeholder {
    color: var(--affine-placeholder-color);
    font-size: var(--affine-font-sm);
  }

  .affine-database-toolbar-item.new-record {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 120px;
    height: 32px;
    padding: 6px 8px;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.05),
      0px 0px 0px 0.5px var(--affine-black-10);
    background: linear-gradient(
        0deg,
        var(--affine-hover-background),
        var(--affine-hover-background)
      ),
      var(--affine-white);
  }
  .new-record > tool-tip {
    max-width: 280px;
  }

  .show-toolbar {
    display: flex;
  }
`;

@customElement('affine-database-toolbar')
export class DatabaseToolbar extends WithDisposable(ShadowlessElement) {
  static override styles = styles;

  @property()
  targetModel!: DatabaseBlockModel;

  @property()
  hoverState!: boolean;

  @property()
  searchState!: SearchState;

  @property()
  addRow!: (index?: number) => void;

  @property()
  setSearchState!: (state: SearchState) => void;

  @property()
  setFilteredRowIds!: (rowIds: string[]) => void;

  @query('.affine-database-search-input')
  private _searchInput!: HTMLInputElement;

  @query('.more-action')
  private _moreActionContainer!: HTMLDivElement;

  @query('.search-container')
  private _searchContainer!: HTMLDivElement;

  @query('.new-record')
  private _newRecord!: HTMLDivElement;

  private _toolbarAction!: ToolbarActionPopup | undefined;

  override firstUpdated() {
    initAddNewRecordHandlers(
      this._newRecord,
      this,
      this._disposables,
      this.addRow
    );
  }

  private get _databaseMap() {
    const databaseMap: DatabaseMap = {};
    for (const child of this.targetModel.children) {
      // The first value is the text context of the row block
      databaseMap[child.id] = [child.text?.toString() ?? ''];
    }

    const { serializedCells } = this.targetModel;
    const rowIds = this.targetModel.children.map(child => child.id);

    rowIds.forEach(rowId => {
      // The map containing all columns related to this row (block)
      const columnMap = serializedCells[rowId];
      if (!columnMap) return;

      // Flatten the columnMap into a list of values
      const columnValues = Object.keys(columnMap).map(key => {
        const value = columnMap[key].value;
        if (Array.isArray(value)) {
          return value.map(item => item.value);
        }
        return columnMap[key].value + '';
      });
      databaseMap[rowId].push(...columnValues.flat());
    });

    return databaseMap;
  }

  private _onSearch = (event: InputEvent) => {
    const el = event.target as HTMLInputElement;
    const inputValue = el.value.trim();
    this.setSearchState(SearchState.Searching);
    if (inputValue === '') {
      this.setSearchState(SearchState.SearchInput);
    }

    const { _databaseMap } = this;
    const existingRowIds = Object.keys(_databaseMap).filter(key => {
      return (
        _databaseMap[key].findIndex(item =>
          item.toLocaleLowerCase().includes(inputValue.toLocaleLowerCase())
        ) > -1
      );
    });

    const filteredRowIds = this.targetModel.children
      .filter(child => existingRowIds.includes(child.id))
      .map(child => child.id);
    this.setFilteredRowIds(filteredRowIds);

    // When deleting the search content, the rich-text in the database row will automatically get the focus,
    // causing the search box to blur. So, here we manually make it focus.
    requestAnimationFrame(() => el.focus());
  };

  private _onSearchKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (this._searchInput.value) {
        this._searchInput.value = '';
        this.setSearchState(SearchState.SearchInput);
      } else {
        this._resetSearchStatus();
      }
    }
  };

  private _clearSearch = (event: MouseEvent) => {
    event.stopPropagation();
    this._searchInput.value = '';
    this.setSearchState(SearchState.SearchInput);
  };

  private _onShowSearch = () => {
    this.setSearchState(SearchState.SearchInput);
    const removeListener = onClickOutside(
      this._searchInput,
      () => {
        if (this.searchState !== SearchState.Searching) {
          this.setSearchState(SearchState.SearchIcon);
          this._searchContainer.style.overflow = 'hidden';
          removeListener();
        }
      },
      'mousedown',
      true
    );
  };

  private _onFocusSearchInput = () => {
    if (this.searchState === SearchState.SearchInput) {
      this._searchInput.focus();
      this._searchContainer.style.overflow = 'unset';
    } else {
      this._searchInput.blur();
    }
  };

  private _onShowAction = () => {
    if (this._toolbarAction) {
      this._closeToolbarAction();
      return;
    }
    this.setSearchState(SearchState.Action);
    this._toolbarAction = new ToolbarActionPopup();
    this._toolbarAction.targetModel = this.targetModel;
    this._toolbarAction.close = this._closeToolbarAction;
    this._moreActionContainer.appendChild(this._toolbarAction);
    createPopper(this._moreActionContainer, this._toolbarAction, {
      placement: 'bottom',
    });
    onClickOutside(
      this._moreActionContainer,
      () => {
        this._closeToolbarAction();
      },
      'mousedown'
    );
  };

  private _closeToolbarAction = () => {
    this._toolbarAction?.remove();
    this._toolbarAction = undefined;
  };

  private _resetSearchStatus = () => {
    this._searchInput.value = '';
    this.setFilteredRowIds([]);
    this.setSearchState(SearchState.SearchIcon);
    this._searchContainer.style.overflow = 'hidden';
  };

  override render() {
    const expandSearch =
      this.searchState === SearchState.SearchInput ||
      this.searchState === SearchState.Searching;
    const isActiveMoreAction = this.searchState === SearchState.Action;
    const searchTool = html`
      <div
        class="affine-database-search-container ${expandSearch
          ? 'search-container-expand'
          : ''}"
        @click=${this._onShowSearch}
        @transitionend=${this._onFocusSearchInput}
      >
        <div class="affine-database-search-input-icon">
          ${DatabaseSearchIcon}
        </div>
        <div class="search-input-container">
          <input
            placeholder="Search..."
            class="affine-database-search-input"
            @input=${this._onSearch}
            @click=${(event: MouseEvent) => event.stopPropagation()}
            @keydown=${this._onSearchKeydown}
          />
          <div class="has-tool-tip close-icon" @click=${this._clearSearch}>
            ${DatabaseSearchClose}
            <tool-tip inert arrow tip-position="top" role="tooltip">
              <span class="code">Esc</span> to clear all
            </tool-tip>
          </div>
        </div>
      </div>
    `;

    return html`<div
      class="affine-database-toolbar ${this.hoverState ? 'show-toolbar' : ''}"
    >
      <div class="affine-database-toolbar-item search-container">
        ${searchTool}
      </div>
      <div
        class="affine-database-toolbar-item more-action ${isActiveMoreAction
          ? 'active'
          : ''}"
        @click=${this._onShowAction}
      >
        ${MoreHorizontalIcon}
      </div>
      <div
        class="has-tool-tip affine-database-toolbar-item new-record"
        draggable="true"
        @click=${() => this.addRow(0)}
      >
        ${PlusIcon}<span>New Record</span>
        <tool-tip inert arrow tip-position="top" role="tooltip"
          >You can drag this button to the desired location and add a record
        </tool-tip>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database-toolbar': DatabaseToolbar;
  }
}
