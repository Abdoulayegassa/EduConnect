'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, BookOpen, Users, Clock, Video, Star, CircleCheck as CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const [activeRole, setActiveRole] = useState<'student' | 'tutor' | null>(null);

  const stats = [
    { icon: Users, label: 'Tuteurs qualifiés', value: '10+' },
    { icon: BookOpen, label: 'Matières disponibles', value: '10+' },
    { icon: Clock, label: 'Heures de cours', value: '50+' },
    { icon: Star, label: 'Satisfaction', value: '4.9/5' }
  ];

  const subjects = [
    'Mathématiques', 'Physique', 'Chimie', 'Français','Anglais','Informatique'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              EduConnect
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/auth/login">
              <Button variant="ghost">Se connecter</Button>
            </Link>
            <Link href="/auth/register">
              <Button>S&apos;inscrire</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge className="mb-6 bg-blue-100 text-blue-700 hover:bg-blue-100">
            <CheckCircle className="w-4 h-4 mr-2" />
            Trouvez votre tuteur en moins de 24h
          </Badge>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 bg-clip-text text-transparent leading-tight">
            Connectez-vous avec le tuteur parfait
          </h1>
          
          <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            Plateforme gratuite et intuitive pour connecter rapidement étudiants et tuteurs qualifiés. 
            Cours en visio ou en présentiel, selon vos préférences.
          </p>

          {/* Role Selection */}
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-12">
            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                activeRole === 'student' ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => setActiveRole('student')}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Je suis étudiant(e)</CardTitle>
                <CardDescription>
                  Je cherche un tuteur pour m&apos;aider dans mes études
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href="/auth/register?role=student">
                  <Button className="w-full" size="lg">
                    Trouver un tuteur
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                activeRole === 'tutor' ? 'ring-2 ring-purple-500 bg-purple-50' : 'hover:bg-gray-50'
              }`}
              onClick={() => setActiveRole('tutor')}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-purple-600" />
                </div>
                <CardTitle className="text-xl">Je suis tuteur</CardTitle>
                <CardDescription>
                  Je veux partager mes connaissances et aider des étudiants
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href="/auth/register?role=tutor">
                  <Button className="w-full bg-purple-600 hover:bg-purple-700" size="lg">
                    Devenir tuteur
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white/70 backdrop-blur-sm py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</div>
                <div className="text-gray-600 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h2 className="text-4xl font-bold mb-6 text-gray-900">Comment ça marche ?</h2>
            <p className="text-xl text-gray-600">Un processus simple en 3 étapes pour connecter étudiants et tuteurs</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-blue-600">1</span>
                </div>
                <CardTitle>Créez votre profil</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Inscription rapide avec vos informations de base et vos besoins académiques.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-purple-600">2</span>
                </div>
                <CardTitle>Matching automatique</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Notre système trouve automatiquement les tuteurs compatibles avec vos critères.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-green-600">3</span>
                </div>
                <CardTitle>Commencez à apprendre</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Recevez votre lien de cours et commencez votre session en visio ou en présentiel.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Subjects Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 py-20 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Matières disponibles</h2>
          <p className="text-xl mb-12 opacity-90">Plus de 10 matières enseignées par des tuteurs qualifiés</p>
          
          <div className="flex flex-wrap gap-3 justify-center max-w-4xl mx-auto">
            {subjects.map((subject, index) => (
              <Badge key={index} variant="secondary" className="bg-white/20 text-white hover:bg-white/30 px-4 py-2 text-sm">
                {subject}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-4xl font-bold mb-6 text-gray-900">Prêt à commencer ?</h2>
            <p className="text-xl text-gray-600 mb-8">
              Rejoignez des dizaines d&apos;étudiants qui ont déjà trouvé leur tuteur idéal
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/register?role=student">
                <Button size="lg" className="w-full sm:w-auto">
                  Je cherche un tuteur
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/auth/register?role=tutor">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Je veux enseigner
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center space-x-2 mb-8">
            <BookOpen className="h-8 w-8 text-blue-400" />
            <span className="text-2xl font-bold">EduConnect</span>
          </div>
          <div className="text-center text-gray-400">
            <p>&copy; 2025 EduConnect. Plateforme gratuite de mise en relation étudiant-tuteur.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}