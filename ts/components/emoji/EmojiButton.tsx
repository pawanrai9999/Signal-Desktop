// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { MutableRefObject } from 'react';
import classNames from 'classnames';
import { get, noop } from 'lodash';
import { Manager, Popper, Reference } from 'react-popper';
import { createPortal } from 'react-dom';
import { Emoji } from './Emoji';
import type { Props as EmojiPickerProps } from './EmojiPicker';
import { EmojiPicker } from './EmojiPicker';
import type { LocalizerType } from '../../types/Util';
import { useRefMerger } from '../../hooks/useRefMerger';
import { handleOutsideClick } from '../../util/handleOutsideClick';
import * as KeyboardLayout from '../../services/keyboardLayout';

export type OwnProps = Readonly<{
  className?: string;
  closeOnPick?: boolean;
  emoji?: string;
  i18n: LocalizerType;
  onClose?: () => unknown;
  emojiButtonApi?: MutableRefObject<EmojiButtonAPI | undefined>;
}>;

export type Props = OwnProps &
  Pick<
    EmojiPickerProps,
    'doSend' | 'onPickEmoji' | 'onSetSkinTone' | 'recentEmojis' | 'skinTone'
  >;

export type EmojiButtonAPI = Readonly<{
  close: () => void;
}>;

export const EmojiButton = React.memo(
  ({
    className,
    closeOnPick,
    emoji,
    emojiButtonApi,
    i18n,
    doSend,
    onClose,
    onPickEmoji,
    skinTone,
    onSetSkinTone,
    recentEmojis,
  }: Props) => {
    const [open, setOpen] = React.useState(false);
    const [popperRoot, setPopperRoot] = React.useState<HTMLElement | null>(
      null
    );
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const refMerger = useRefMerger();

    const handleClickButton = React.useCallback(() => {
      if (popperRoot) {
        setOpen(false);
      } else {
        setOpen(true);
      }
    }, [popperRoot, setOpen]);

    const handleClose = React.useCallback(() => {
      setOpen(false);
      if (onClose) {
        onClose();
      }
    }, [setOpen, onClose]);

    const api = React.useMemo(
      () => ({
        close: () => setOpen(false),
      }),
      [setOpen]
    );

    if (emojiButtonApi) {
      // Using a React.MutableRefObject, so we need to reassign this prop.
      // eslint-disable-next-line no-param-reassign
      emojiButtonApi.current = api;
    }

    // Create popper root and handle outside clicks
    React.useEffect(() => {
      if (open) {
        const root = document.createElement('div');
        setPopperRoot(root);
        document.body.appendChild(root);

        return () => {
          document.body.removeChild(root);
          setPopperRoot(null);
        };
      }

      return noop;
    }, [open, setOpen, setPopperRoot, handleClose]);

    React.useEffect(() => {
      if (!open) {
        return noop;
      }

      return handleOutsideClick(
        () => {
          handleClose();
          return true;
        },
        { containerElements: [popperRoot, buttonRef] }
      );
    }, [open, handleClose, popperRoot]);

    // Install keyboard shortcut to open emoji picker
    React.useEffect(() => {
      const handleKeydown = (event: KeyboardEvent) => {
        const { ctrlKey, metaKey, shiftKey } = event;
        const commandKey = get(window, 'platform') === 'darwin' && metaKey;
        const controlKey = get(window, 'platform') !== 'darwin' && ctrlKey;
        const commandOrCtrl = commandKey || controlKey;
        const key = KeyboardLayout.lookup(event);

        // We don't want to open up if the conversation has any panels open
        const panels = document.querySelectorAll('.conversation .panel');
        if (panels && panels.length > 1) {
          return;
        }

        if (commandOrCtrl && shiftKey && (key === 'j' || key === 'J')) {
          event.stopPropagation();
          event.preventDefault();

          setOpen(!open);
        }
      };
      document.addEventListener('keydown', handleKeydown);

      return () => {
        document.removeEventListener('keydown', handleKeydown);
      };
    }, [open, setOpen]);

    return (
      <Manager>
        <Reference>
          {({ ref }) => (
            <button
              type="button"
              ref={refMerger(buttonRef, ref)}
              onClick={handleClickButton}
              className={classNames(className, {
                'module-emoji-button__button': true,
                'module-emoji-button__button--active': open,
                'module-emoji-button__button--has-emoji': Boolean(emoji),
              })}
              aria-label={i18n('EmojiButton__label')}
            >
              {emoji && <Emoji emoji={emoji} size={24} />}
            </button>
          )}
        </Reference>
        {open && popperRoot
          ? createPortal(
              <Popper placement="top-start" strategy="fixed">
                {({ ref, style }) => (
                  <EmojiPicker
                    ref={ref}
                    i18n={i18n}
                    style={style}
                    onPickEmoji={ev => {
                      onPickEmoji(ev);
                      if (closeOnPick) {
                        handleClose();
                      }
                    }}
                    doSend={doSend}
                    onClose={handleClose}
                    skinTone={skinTone}
                    onSetSkinTone={onSetSkinTone}
                    recentEmojis={recentEmojis}
                  />
                )}
              </Popper>,
              popperRoot
            )
          : null}
      </Manager>
    );
  }
);
