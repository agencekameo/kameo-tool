'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, CheckCircle2, Loader2, ImageIcon, X } from 'lucide-react'
import { useParams } from 'next/navigation'

export default function GmbPhotosPortal() {
  const { token } = useParams<{ token: string }>()
  const [portal, setPortal] = useState<{ clientName?: string; instructions?: string; maxPhotos: number; businessName: string } | null>(null)
  const [photoCount, setPhotoCount] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(0)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/gmb/portal/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return }
        setPortal(data.portal)
        setPhotoCount(data.photoCount)
        setRemaining(data.remaining)
      })
      .catch(() => setError('Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleUpload() {
    if (selectedFiles.length === 0) return
    setUploading(true)
    try {
      const form = new FormData()
      selectedFiles.forEach(f => form.append('files', f))
      const res = await fetch(`/api/gmb/portal/${token}`, { method: 'POST', body: form })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setUploaded(data.uploaded)
      setPhotoCount(prev => prev + data.uploaded)
      setRemaining(prev => prev - data.uploaded)
      setSelectedFiles([])
    } catch { setError('Erreur lors de l\'envoi') }
    finally { setUploading(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-gray-400" />
    </div>
  )

  if (error && !portal) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-gray-800 font-medium text-lg mb-2">Lien invalide</p>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    </div>
  )

  return (
    <html lang="fr" style={{ colorScheme: 'light' }}>
      <body className="min-h-screen bg-gray-50">
        <div className="max-w-xl mx-auto p-6 pt-12">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center mx-auto mb-4">
              <ImageIcon size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{portal?.businessName}</h1>
            <p className="text-gray-500 mt-1">Envoyez vos photos pour votre fiche Google</p>
          </div>

          {/* Instructions */}
          {portal?.instructions && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
              <p className="text-blue-800 text-sm">{portal.instructions}</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{photoCount}</p>
              <p className="text-gray-500 text-xs">Photos envoyées</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{remaining}</p>
              <p className="text-gray-500 text-xs">Restantes</p>
            </div>
          </div>

          {/* Upload success */}
          {uploaded > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <p className="text-emerald-800 text-sm font-medium">{uploaded} photo{uploaded > 1 ? 's' : ''} envoyée{uploaded > 1 ? 's' : ''} avec succès !</p>
            </div>
          )}

          {remaining > 0 ? (
            <>
              {/* File selection */}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { if (e.target.files) setSelectedFiles(Array.from(e.target.files).slice(0, remaining)) }} />

              <div className="bg-white border-2 border-dashed border-gray-300 hover:border-pink-400 rounded-2xl p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer mb-4"
                onClick={() => fileRef.current?.click()}>
                <Upload size={32} className="text-gray-400" />
                <p className="text-gray-600 text-sm text-center">
                  Cliquez ou glissez-déposez vos photos
                </p>
                <p className="text-gray-400 text-xs">PNG, JPG, WebP — max {remaining} photo{remaining > 1 ? 's' : ''}</p>
              </div>

              {/* Selected files preview */}
              {selectedFiles.length > 0 && (
                <div className="space-y-3 mb-4">
                  <p className="text-gray-700 text-sm font-medium">{selectedFiles.length} fichier{selectedFiles.length > 1 ? 's' : ''} sélectionné{selectedFiles.length > 1 ? 's' : ''}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {selectedFiles.map((f, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                        <button onClick={e => { e.stopPropagation(); setSelectedFiles(prev => prev.filter((_, j) => j !== i)) }}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleUpload} disabled={uploading}
                    className="w-full bg-gradient-to-r from-pink-500 to-orange-400 hover:opacity-90 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    Envoyer {selectedFiles.length} photo{selectedFiles.length > 1 ? 's' : ''}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-100 rounded-xl p-6 text-center">
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
              <p className="text-gray-700 font-medium">Merci !</p>
              <p className="text-gray-500 text-sm mt-1">Vous avez atteint la limite de photos.</p>
            </div>
          )}

          {error && portal && (
            <p className="text-red-500 text-sm text-center mt-4">{error}</p>
          )}

          {/* Footer */}
          <p className="text-center text-gray-400 text-xs mt-8">
            Propulsé par Kameo
          </p>
        </div>
      </body>
    </html>
  )
}
