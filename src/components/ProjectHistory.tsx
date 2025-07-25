
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  FolderOpen, 
  Calendar, 
  ExternalLink, 
  Trash2, 
  Eye,
  FileText,
  Rocket,
  Clock,
  CheckCircle,
  RefreshCw,
  Edit,
  FolderTree
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useWalletAuth } from '@/contexts/WalletAuthContext';
import { useAICode } from '@/contexts/AICodeContext';
import type { Json } from '@/integrations/supabase/types';

interface ProjectFile {
  id: string;
  name: string;
  type: string;
  content: string;
  parentId?: string;
}

interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
  created_at: string;
  tx_hash?: string;
  contract_address?: string;
  files?: ProjectFile[];
}

const ProjectHistory = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { toast } = useToast();
  const { userProfile } = useWalletAuth();
  const { loadProject, currentProject } = useAICode();

  const parseProjectFiles = (files: Json): ProjectFile[] => {
    if (!files) return [];
    
    try {
      if (Array.isArray(files)) {
        return files.map((file, index) => {
          if (typeof file === 'object' && file !== null) {
            const fileObj = file as Record<string, unknown>;
            return {
              id: (fileObj.id as string) || `file_${index}`,
              name: (fileObj.name as string) || `file_${index + 1}.move`,
              type: (fileObj.type as string) || 'move',
              content: (fileObj.content as string) || '',
              parentId: fileObj.parentId as string | undefined
            };
          }
          return {
            id: `file_${index}`,
            name: `file_${index + 1}.move`,
            type: 'move',
            content: typeof file === 'string' ? file : '',
          };
        });
      } else if (typeof files === 'object' && files !== null) {
        return Object.values(files as Record<string, unknown>).map((file, index) => {
          if (typeof file === 'object' && file !== null) {
            const fileObj = file as Record<string, unknown>;
            return {
              id: (fileObj.id as string) || `file_${index}`,
              name: (fileObj.name as string) || `file_${index + 1}.move`,
              type: (fileObj.type as string) || 'move',
              content: (fileObj.content as string) || '',
              parentId: fileObj.parentId as string | undefined
            };
          }
          return {
            id: `file_${index}`,
            name: `file_${index + 1}.move`,
            type: 'move',
            content: typeof file === 'string' ? file : '',
          };
        });
      }
    } catch (e) {
      console.error('Error parsing files:', e);
    }
    
    return [];
  };

  const loadProjects = async (showRefreshingIndicator = false) => {
    if (!userProfile) {
      setLoading(false);
      return;
    }

    try {
      if (showRefreshingIndicator) setRefreshing(true);
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      const convertedProjects: Project[] = (data || []).map(item => {
        const files = parseProjectFiles(item.files);

        return {
          id: item.id,
          name: item.name || 'Untitled Project',
          type: item.type || 'move_contract',
          status: item.status || 'draft',
          created_at: item.created_at || new Date().toISOString(),
          tx_hash: item.tx_hash || undefined,
          contract_address: item.contract_address || undefined,
          files: files
        };
      });

      setProjects(convertedProjects);
      
      if (showRefreshingIndicator) {
        toast({
          title: "Projects Refreshed",
          description: `Loaded ${convertedProjects.length} project(s)`,
        });
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      toast({
        title: "Failed to Load Projects",
        description: "There was an error loading your projects. Please try refreshing.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      if (showRefreshingIndicator) setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [userProfile]);

  const handleRefresh = () => {
    loadProjects(true);
  };

  const handleLoadProject = (project: Project) => {
    if (!project.files || project.files.length === 0) {
      toast({
        title: "No Files Found",
        description: "This project doesn't contain any files to load.",
        variant: "destructive"
      });
      return;
    }

    const projectData = {
      id: project.id,
      name: project.name,
      files: project.files.map(file => ({
        id: file.id,
        name: file.name,
        type: file.type as 'file' | 'folder',
        content: file.content,
        parentId: file.parentId
      })),
      createdAt: project.created_at,
      updatedAt: new Date().toISOString()
    };

    loadProject(projectData);
    
    toast({
      title: "Project Loaded",
      description: `${project.name} has been loaded into the editor.`,
    });
  };

  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      toast({
        title: "Project Deleted",
        description: "Project has been permanently deleted."
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete project. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'deployed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'draft':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return <FileText className="w-4 h-4 text-electric-blue-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deployed':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'draft':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-electric-blue-500/20 text-electric-blue-300 border-electric-blue-500/30';
    }
  };

  const organizeFilesByFolder = (files: ProjectFile[]) => {
    const folderStructure: { [key: string]: ProjectFile[] } = {};
    
    files.forEach(file => {
      const pathParts = file.name.split('/');
      if (pathParts.length > 1) {
        const folder = pathParts[0];
        if (!folderStructure[folder]) {
          folderStructure[folder] = [];
        }
        folderStructure[folder].push({
          ...file,
          name: pathParts.slice(1).join('/')
        });
      } else {
        if (!folderStructure['root']) {
          folderStructure['root'] = [];
        }
        folderStructure['root'].push(file);
      }
    });
    
    return folderStructure;
  };

  if (loading) {
    return (
      <Card className="h-full bg-cyber-black-400/50 border-electric-blue-500/20 backdrop-blur-sm">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-8 h-8 bg-electric-blue-500 rounded-full animate-pulse mx-auto mb-4"></div>
            <p className="text-electric-blue-300">Loading projects...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-cyber-black-400/50 border-electric-blue-500/20 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-electric-blue-100 flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Project History
            {currentProject && (
              <Badge className="bg-electric-blue-500/20 text-electric-blue-300 border-electric-blue-500/30">
                Editing: {currentProject.name}
              </Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-electric-blue-500/30 text-electric-blue-300 hover:bg-electric-blue-500/10"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {projects.length === 0 ? (
          <div className="text-center py-12">
            <FolderOpen className="w-16 h-16 text-electric-blue-400/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-electric-blue-200 mb-2">No Projects Yet</h3>
            <p className="text-electric-blue-400/70 mb-6">
              Start by asking the AI to create a smart contract, or use the Editor mode to create projects.
            </p>
            <Button
              onClick={handleRefresh}
              className="bg-electric-blue-500 hover:bg-electric-blue-600 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Check Again
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-4">
              {projects.map((project) => (
                <Card key={project.id} className="bg-cyber-black-300/30 border-electric-blue-500/10 hover:bg-cyber-black-300/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(project.status)}
                          <h3 className="font-semibold text-electric-blue-100">{project.name}</h3>
                          <Badge className={getStatusColor(project.status)}>
                            {project.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-electric-blue-300 mb-3">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(project.created_at).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {project.type.replace('_', ' ').toUpperCase()}
                          </span>
                          {project.files && (
                            <span className="flex items-center gap-1">
                              <FolderTree className="w-3 h-3" />
                              {project.files.length} file(s)
                            </span>
                          )}
                        </div>

                        {project.contract_address && (
                          <div className="text-xs text-green-300 mb-2">
                            <span className="font-mono bg-cyber-black-100/30 px-2 py-1 rounded">
                              {project.contract_address}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-electric-blue-500/30 text-electric-blue-300 hover:bg-electric-blue-500/10"
                          onClick={() => handleLoadProject(project)}
                          disabled={currentProject?.id === project.id}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          {currentProject?.id === project.id ? 'Current' : 'Load'}
                        </Button>
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-electric-blue-500/30 text-electric-blue-300 hover:bg-electric-blue-500/10"
                              onClick={() => setSelectedProject(project)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-cyber-black-400 border-electric-blue-500/20 max-w-4xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle className="text-electric-blue-100">
                                {selectedProject?.name}
                              </DialogTitle>
                            </DialogHeader>
                            <ScrollArea className="max-h-[60vh]">
                              {selectedProject?.files && selectedProject.files.length > 0 ? (
                                <div className="space-y-4">
                                  {Object.entries(organizeFilesByFolder(selectedProject.files)).map(([folderName, folderFiles]) => (
                                    <div key={folderName} className="space-y-2">
                                      {folderName !== 'root' && (
                                        <div className="flex items-center gap-2 text-electric-blue-300 font-medium text-sm py-2 border-b border-electric-blue-500/20">
                                          <FolderOpen className="w-4 h-4 text-electric-blue-400" />
                                          <span>{folderName}/</span>
                                        </div>
                                      )}
                                      {folderFiles.map((file: ProjectFile, index: number) => (
                                        <div key={index} className="border border-electric-blue-500/20 rounded-lg ml-4">
                                          <div className="bg-cyber-black-300/50 px-4 py-2 border-b border-electric-blue-500/20">
                                            <span className="text-electric-blue-200 font-mono text-sm">
                                              {file.name}
                                            </span>
                                          </div>
                                          <pre className="p-4 text-sm text-electric-blue-200 overflow-x-auto">
                                            <code>{file.content || 'No content available'}</code>
                                          </pre>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-electric-blue-400">No files available for this project.</p>
                              )}
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                        
                        {project.tx_hash && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-500/30 text-green-300 hover:bg-green-500/10"
                            onClick={() => window.open(`https://explorer.devnet.moved.network/tx/${project.tx_hash}`, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        )}
                        
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-500/30 text-red-300 hover:bg-red-500/10"
                          onClick={() => deleteProject(project.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default ProjectHistory;
