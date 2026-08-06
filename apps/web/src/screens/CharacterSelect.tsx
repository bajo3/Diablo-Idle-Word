/**
 * CharacterSelect: la sala de personajes, con la lectura de un MMO clásico.
 *
 * Un roster a la izquierda con retrato, clase y nivel; el detalle del personaje elegido a la
 * derecha; y una sola acción grande abajo: ENTRAR AL MUNDO. La creación de personaje y el renombre
 * de cuenta viven en paneles secundarios para que la vista principal sea *elegir con quién jugás*.
 *
 * Los textos de acción ("Seleccionar", "Eliminar", "Cerrar sesión", "Guardar perfil") se conservan
 * porque son el contrato accesible verificado por App.test.tsx.
 */
import type { FormEvent } from 'react';
import {
  CHARACTER_CLASS_OPTIONS,
  characterClassDisplayName,
  type CharacterClassId,
} from '@brecha/shared';

import { Icon, type IconName } from '../components/Icon';
import {
  GatewayConnectionStatus,
  GatewayCrest,
  GatewayFrame,
  type GatewayConnection,
} from './Gateway';

export type RosterCharacter = Readonly<{
  id: string;
  name: string;
  class: CharacterClassId;
  level: number;
  availability: string;
  selected: boolean;
}>;

/** Un emblema por arquetipo: hasta que cada clase tenga retrato propio, el icono la distingue. */
const CLASS_EMBLEM: Partial<Record<CharacterClassId, IconName>> = {
  BARBARIAN: 'axe',
  GUARDIAN: 'shield',
};

const AVAILABILITY_LABEL: Record<string, string> = {
  AVAILABLE: 'En el pueblo',
  AWAY_FARMING: 'Ausente · farmeando',
  AWAY_RESTING: 'Ausente · descansando',
};

function availabilityLabel(availability: string): string {
  return AVAILABILITY_LABEL[availability] ?? availability;
}

export function CharacterSelect({
  displayName,
  email,
  connection,
  characters,
  busyKeys,
  notice,
  pendingDeletion,
  newName,
  newClass,
  profileDraft,
  onNewNameChange,
  onNewClassChange,
  onProfileDraftChange,
  onCreate,
  onUpdateProfile,
  onSelect,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onEnterWorld,
  onLogout,
  onStatus,
}: {
  displayName: string;
  email: string;
  connection: GatewayConnection;
  characters: readonly RosterCharacter[];
  busyKeys: ReadonlySet<string>;
  notice: string | undefined;
  pendingDeletion: string | undefined;
  newName: string;
  newClass: CharacterClassId;
  profileDraft: string;
  onNewNameChange: (value: string) => void;
  onNewClassChange: (value: CharacterClassId) => void;
  onProfileDraftChange: (value: string) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onUpdateProfile: (event: FormEvent<HTMLFormElement>) => void;
  onSelect: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onEnterWorld: () => void;
  onLogout: () => void;
  onStatus: () => void;
}) {
  const active = characters.find((character) => character.selected);
  const canEnter = active !== undefined && active.availability === 'AVAILABLE';

  return (
    <GatewayFrame wide>
      <GatewayCrest subtitle="Selección de personaje" />

      <div className="cs-account">
        <div>
          {/* El nombre de cuenta es el encabezado de la vista autenticada. */}
          <h2 className="cs-account-name">{displayName}</h2>
          <p className="cs-account-mail">{email}</p>
        </div>
        <div className="cs-account-actions">
          <button className="gateway-link" onClick={onStatus} type="button">
            Estado
          </button>
          <button
            className="gateway-link"
            disabled={busyKeys.has('logout')}
            onClick={onLogout}
            type="button"
          >
            Cerrar sesión
          </button>
        </div>
      </div>

      <div className="cs-layout">
        <section aria-labelledby="cs-roster-title" className="cs-roster">
          <h3 className="cs-section-title" id="cs-roster-title">
            Personajes
          </h3>
          {characters.length === 0 ? (
            <p className="cs-empty">Todavía no creaste ningún personaje.</p>
          ) : (
            <ul className="cs-roster-list">
              {characters.map((character) => (
                <li
                  className="cs-slot"
                  data-selected={character.selected ? 'true' : 'false'}
                  key={character.id}
                >
                  <span aria-hidden="true" className="cs-portrait">
                    <Icon name={CLASS_EMBLEM[character.class] ?? 'user'} size={30} />
                  </span>
                  <div className="cs-slot-body">
                    <strong className="cs-slot-name">{character.name}</strong>
                    <small className="cs-slot-meta">
                      Nv. {character.level} · {characterClassDisplayName(character.class)}
                    </small>
                    <small className="cs-slot-state">
                      {availabilityLabel(character.availability)}
                    </small>
                  </div>
                  <div className="cs-slot-actions">
                    {character.selected ? (
                      <span className="cs-slot-badge">Seleccionado</span>
                    ) : (
                      <button
                        className="cs-mini"
                        disabled={
                          character.availability !== 'AVAILABLE' ||
                          busyKeys.has(`guardian:select:${character.id}`)
                        }
                        onClick={() => onSelect(character.id)}
                        type="button"
                      >
                        Seleccionar
                      </button>
                    )}
                    <button
                      className="cs-mini cs-mini--danger"
                      disabled={
                        character.availability !== 'AVAILABLE' ||
                        busyKeys.has(`guardian:delete:${character.id}`)
                      }
                      onClick={() => onRequestDelete(character.id)}
                      type="button"
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="cs-create-title" className="cs-create">
          <h3 className="cs-section-title" id="cs-create-title">
            Nuevo personaje
          </h3>
          <form className="cs-form" onSubmit={onCreate}>
            <label className="gateway-field">
              <span>Nombre</span>
              <input
                maxLength={24}
                onChange={(event) => onNewNameChange(event.target.value)}
                placeholder="Nombre del Guardián"
                required
                value={newName}
              />
            </label>
            <label className="gateway-field">
              <span>Clase</span>
              <select
                onChange={(event) => onNewClassChange(event.target.value as CharacterClassId)}
                value={newClass}
              >
                {CHARACTER_CLASS_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.displayName} · {option.archetype}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="cs-secondary"
              disabled={busyKeys.has('guardian:create')}
              type="submit"
            >
              Crear Guardián
            </button>
          </form>
          <p className="cs-hint">
            Las siete clases comparten el perfil de combate del Guardián mientras completamos sus
            kits propios.
          </p>

          <h3 className="cs-section-title">Cuenta</h3>
          <form className="cs-form" onSubmit={onUpdateProfile}>
            <label className="gateway-field">
              <span>Nombre visible</span>
              <input
                onChange={(event) => onProfileDraftChange(event.target.value)}
                placeholder={displayName}
                required
                value={profileDraft}
              />
            </label>
            <button
              className="cs-secondary"
              disabled={busyKeys.has('profile:update')}
              type="submit"
            >
              Guardar perfil
            </button>
          </form>
        </section>
      </div>

      {pendingDeletion === undefined ? null : (
        <section aria-label="Confirmar eliminación" className="cs-confirm">
          <p>La eliminación del Guardián se confirmará en el servidor. No se puede deshacer.</p>
          <div className="cs-confirm-actions">
            <button className="cs-mini" onClick={onCancelDelete} type="button">
              Cancelar
            </button>
            <button
              className="cs-mini cs-mini--danger"
              disabled={busyKeys.has(`guardian:delete:${pendingDeletion}`)}
              onClick={onConfirmDelete}
              type="button"
            >
              Confirmar eliminación
            </button>
          </div>
        </section>
      )}

      <button className="cs-enter" disabled={!canEnter} onClick={onEnterWorld} type="button">
        <Icon name="portal" size={22} />
        Entrar al mundo
      </button>
      {canEnter ? null : (
        <p className="cs-enter-hint">Elegí un personaje disponible para cruzar la brecha.</p>
      )}

      {notice === undefined ? null : (
        <p aria-live="polite" className="gateway-notice">
          {notice}
        </p>
      )}
      <GatewayConnectionStatus state={connection} />
    </GatewayFrame>
  );
}
