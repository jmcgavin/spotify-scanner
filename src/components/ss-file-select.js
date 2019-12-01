import { LitElement, html, css } from 'lit-element'
import { GlobalStyles } from '../styles/global-styles'
import { removeFromString } from '../../helpers/utils'
import levenshteinDifference from '../../scripts/leven'

import { searchTrack, convertSpotifyArtists } from '../../helpers/spotify'

import './ss-table'
import './ss-button'
import './ss-spinner'

/**
 * Handles the file selection portion of the application.
 * @extends LitElement
 * @prop {Boolean} _session - Is user connected to Spotify?
 */
export class SSFileSelect extends LitElement {
  static get properties () {
    return {
      tracks: { type: Array }
    }
  }

  static get styles () {
    return [
      GlobalStyles,
      css`
        :host {
          display: grid;
          width: 90%;
          margin: 0 auto;
          grid-template-rows: auto auto;
          grid-gap: 16px;
        }
        input {
          display: none;
        }
        #buttonCon {
          display: grid;
          grid-template-columns: max-content max-content auto;
        }
        #buttonCon ss-button {
          align-self: end;
          width: fit-content;
        }
        #fileSelectButton {
          --background-color: var(--app-blue);
          margin-right: 16px;
        }
        #buttonCon h2 {
          font-family: Roboto, sans-serif;
          font-size: 14px;
          font-weight: normal;
          align-self: end;
          margin: 0;
          justify-self: end;
          color: var(--app-light-text);
          padding-right: 8px;
        }
      `
    ]
  }

  get _fileSelectInput () {
    return this.renderRoot.querySelector('input')
  }

  get _table () {
    return this.renderRoot.querySelector('ss-table')
  }

  constructor () {
    super()
    this.tracks = []
  }

  render () {
    return html`
      <input
        @change="${this._readFiles}"
        type="file"
        accept="audio/*"
        multiple>

      <div id="buttonCon">
        <ss-button
          .label=${'Select files'}
          .icon=${'library_music'}
          @click=${this._handleFileSelect}
          id="fileSelectButton">
        </ss-button>
        <ss-button
          ?disabled=${!this.tracks.length}
          .label=${'Search Spotify'}
          .icon=${'search'}
          @click=${this._searchSpotify}
          id="spotifySearchButton">
        </ss-button>
        <h2>Total: ${this.tracks.length}</h2>
      </div>

      <ss-table
        .tracks="${this.tracks}"
        ?tracks-selected=${this.tracks.length}>
      </ss-table>
    `
  }

  async _searchSpotify () {
    for (let i = 0; i < this.tracks.length; i++) {
      const localTrack = this.tracks[i]
      const filteredArtist = removeFromString({
        string: localTrack.artist,
        regEx: /\sfeaturing|\sfeat|\sft|\svs|\sand|\s&|,|\./gi,
        normalizeWhitespace: true
      })
      const filteredTitle = removeFromString({
        string: localTrack.title,
        regEx: /\s\(Original|\s\(Official|\s\(Extended|\s\(Radio|\s\(Pro|\s\(DJ|\sBootleg\)|\sMix\)|\sEdit\)|\(|\)/gi,
        normalizeWhitespace: true
      })
      await searchTrack(filteredArtist, filteredTitle).then(result => {
        this._compareResult(localTrack, result)
      })
    }
  }

  _compareResult (localTrack, result) {
    // console.log(result)
    // console.log(localTrack)
    if (result.length) {
      const artistOnSpotify = convertSpotifyArtists(result[0].artists)

      const filteredLocalArtist = removeFromString({
        string: localTrack.artist,
        regEx: /\sfeaturing|\sfeat|\sft|\svs|\sand|\s&|,|\./gi,
        normalizeWhitespace: true
      })
      const filteredLocalTitle = removeFromString({
        string: localTrack.title,
        regEx: /\s\(Original|\s\(Official|\s\(Extended|\s\(Radio|\s\(Pro|\s\(DJ|\sBootleg\)|\sMix\)|\sEdit\)|\(|\)/gi,
        normalizeWhitespace: true
      })

      const stringDifference = levenshteinDifference(
        `${filteredLocalArtist.toLowerCase()} ${filteredLocalTitle.toLowerCase()}`,
        `${artistOnSpotify.toLowerCase()} ${result[0].name.toLowerCase()}`
      )

      console.group(`%cFound (${result.length})`, 'color: #1DB954;')
      console.log(`Spotify: ${artistOnSpotify} - ${result[0].name}`)
      console.log(`Local: ${filteredLocalArtist} - ${filteredLocalTitle}`)
      console.log(`%cDifference: ${stringDifference}`,
        `${stringDifference >= 50 ? 'color: #F2545B;' : stringDifference >= 25 ? 'color: #F9CB40;' : 'color: #1DB954;'}`
      )
      console.groupEnd()
    } else {
      console.log(`%cNo results: %c${localTrack.artist} ${localTrack.title}`, 'color: #F2545B;', 'color: default;')
    }
  }

  _readFiles () {
    const fileArray = Array.from(this._fileSelectInput.files)
    const promises = []

    if (fileArray.length) {
      for (const file of fileArray) {
        promises.push(new Promise((resolve, reject) => {
          window.jsmediatags.read(file, {
            onSuccess: (tags) => {
              resolve(tags)
            },
            onError: (error) => {
              console.log(error.message)
              reject(error)
            }
          })
        }))
      }
      this._returnTags(promises)
    }
  }

  async _returnTags (promiseArray) {
    // console.time('_readFiles timer')
    await window.Promise.map(promiseArray, (tags, index) => ({
      id: index + 1,
      title: tags.tags.title || undefined,
      artist: tags.tags.artist || undefined,
      album: tags.tags.album || undefined,
      year: tags.tags.year || undefined
    }), {
      concurrency: 5
    }).then(tracks => {
      this.tracks = tracks
      this.dispatchEvent(new CustomEvent('tracks-selected', {
        detail: this.tracks
      }))
    }, error => {
      console.log(error.message)
    })
  }

  _handleFileSelect () {
    this._fileSelectInput.click()
  }
}

window.customElements.define('ss-file-select', SSFileSelect)
